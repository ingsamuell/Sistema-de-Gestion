'use server';

import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

export interface IssueCertificateInput {
  projectId: string;
}

export interface IssueCertificateResponse {
  success: boolean;
  hash?: string;
  numeroCertificado?: string;
  error?: string;
}

export async function issueCertificateAction(
  input: IssueCertificateInput,
): Promise<IssueCertificateResponse> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'No autorizado.' };
    }

    // 1. Obtener proyecto y tareas desde 'projects'
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, titulo, completado')
      .eq('id', input.projectId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (projectError || !project) {
      return { success: false, error: 'Proyecto no encontrado o no tienes permisos sobre él.' };
    }

    const { data: tasks, error: tasksError } = await supabase
      .from('tareas')
      .select('id, titulo, completado, quiz_aprobado, duracion')
      .eq('id_proyecto', input.projectId);

    if (tasksError) {
      console.error('Error fetching tasks for certificate:', tasksError);
      return { success: false, error: 'Error al verificar las tareas del proyecto.' };
    }

    // 2. Validar que todas las tareas del proyecto tengan quiz_aprobado
    const allTasks = tasks || [];
    if (allTasks.length === 0) {
      return {
        success: false,
        error: 'El proyecto no tiene tareas registradas para certificar.',
      };
    }

    const quizzesApproved = allTasks.filter((t) => Boolean(t.quiz_aprobado));
    if (quizzesApproved.length < allTasks.length) {
      return {
        success: false,
        error: `Debes aprobar los micro-quizzes de todas las tareas (${quizzesApproved.length}/${allTasks.length} aprobados) antes de certificarte.`,
      };
    }

    // Sincronizar en la base de datos que todas las tareas y el proyecto queden completados al 100%
    await supabase
      .from('tareas')
      .update({ completado: true, quiz_aprobado: true })
      .eq('id_proyecto', input.projectId);

    await supabase
      .from('projects')
      .update({ completado: true, progreso: 100 })
      .eq('id', input.projectId);

    // 3. Calcular horas invertidas (la duración de tareas se guarda en minutos)
    const totalMinutes = allTasks.reduce((acc, t) => acc + (Number(t.duracion) || 60), 0);
    const horasTotales = Math.max(1, Math.round(totalMinutes / 60));

    // 4. Verificar si ya existe el certificado
    const { data: existingCert } = await supabase
      .from('certificados_emitidos')
      .select('*')
      .eq('profile_id', user.id)
      .eq('project_id', input.projectId)
      .maybeSingle();

    if (existingCert) {
      const year = new Date(existingCert.fecha_emision || Date.now()).getFullYear();
      const fallbackNumero = `KMB-${year}-${existingCert.hash_sha256.slice(0, 4).toUpperCase()}-${existingCert.hash_sha256.slice(4, 8).toUpperCase()}`;
      const numero =
        (existingCert as { numero_certificado?: string | null })?.numero_certificado ||
        fallbackNumero;

      if (!existingCert.numero_certificado) {
        // Intentar actualizar retrospectivamente en segundo plano si la columna existe
        supabase
          .from('certificados_emitidos')
          .update({ numero_certificado: numero })
          .eq('hash_sha256', existingCert.hash_sha256)
          .then(() => {});
      }
      return { success: true, hash: existingCert.hash_sha256, numeroCertificado: numero };
    }

    // 5. Generar Número de Certificado Único y Hash Criptográfico
    // Formato estándar de acreditación (Coursera / Credly): KMB-YYYY-XXXX-XXXX
    const year = new Date().getFullYear();
    const rawData = `${user.id}-${input.projectId}-${new Date().toISOString()}-${crypto.randomBytes(8).toString('hex')}`;
    const hash = crypto.createHash('sha256').update(rawData).digest('hex');
    const certNumber = `KMB-${year}-${hash.slice(0, 4).toUpperCase()}-${hash.slice(4, 8).toUpperCase()}`;

    // 6. Insertar en la base de datos
    const insertPayload: Record<string, unknown> = {
      profile_id: user.id,
      project_id: input.projectId,
      numero_certificado: certNumber,
      hash_sha256: hash,
      horas_invertidas: horasTotales,
      temas_aprobados: allTasks.length,
    };

    let { error: insertError } = await supabase.from('certificados_emitidos').insert(insertPayload);

    // Si falla porque la columna numero_certificado no existe aún en la base de datos remota, reintentar sin ella
    if (
      insertError &&
      (insertError.message?.includes('numero_certificado') || insertError.code === '42703')
    ) {
      console.warn('[issueCertificateAction] Reintentando inserción sin numero_certificado...');
      delete insertPayload.numero_certificado;
      const retry = await supabase.from('certificados_emitidos').insert(insertPayload);
      insertError = retry.error;
    }

    if (insertError) {
      // Manejar caso de carrera: certificado ya registrado para este proyecto
      if (insertError.code === '23505') {
        const { data: raceCert } = await supabase
          .from('certificados_emitidos')
          .select('*')
          .eq('profile_id', user.id)
          .eq('project_id', input.projectId)
          .maybeSingle();

        if (raceCert) {
          const num =
            raceCert.numero_certificado ||
            `KMB-${new Date(raceCert.fecha_emision).getFullYear()}-${raceCert.hash_sha256.slice(0, 4).toUpperCase()}-${raceCert.hash_sha256.slice(4, 8).toUpperCase()}`;
          return {
            success: true,
            hash: raceCert.hash_sha256,
            numeroCertificado: num,
          };
        }
      }

      console.error('Insert error in certificados_emitidos:', insertError);
      return {
        success: false,
        error: `No se pudo registrar el certificado en la base de datos (${insertError.message || insertError.code || 'Error al insertar'}). Asegúrate de haber ejecutado la migración de certificados en Supabase.`,
      };
    }

    return {
      success: true,
      hash,
      numeroCertificado: certNumber,
    };
  } catch (error) {
    console.error('Error in issueCertificateAction:', error);
    return { success: false, error: 'Ocurrió un error inesperado al emitir el certificado.' };
  }
}

export async function checkCertificateStatus(projectId: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { issued: false };

    const { data: existingCert, error } = await supabase
      .from('certificados_emitidos')
      .select('*')
      .eq('profile_id', user.id)
      .eq('project_id', projectId)
      .maybeSingle();

    if (error || !existingCert) {
      return { issued: false };
    }

    const numero =
      (existingCert as { numero_certificado?: string | null })?.numero_certificado ||
      `KMB-${new Date(existingCert.fecha_emision || Date.now()).getFullYear()}-${existingCert.hash_sha256.slice(0, 4).toUpperCase()}-${existingCert.hash_sha256.slice(4, 8).toUpperCase()}`;

    return {
      issued: true,
      hash: existingCert.hash_sha256,
      numeroCertificado: numero,
    };
  } catch {
    return { issued: false };
  }
}

export async function verifyCertificateAction(codeOrHash: string) {
  try {
    const supabase = await createClient();
    const cleanQuery = codeOrHash.trim();
    if (!cleanQuery) {
      return { success: false, error: 'Código de verificación no proporcionado.' };
    }

    // Buscar por numero_certificado o por hash_sha256
    interface CertificadoRow {
      id: string;
      project_id: string;
      profile_id: string;
      numero_certificado?: string | null;
      hash_sha256: string;
      fecha_emision: string;
      horas_invertidas?: number;
      temas_aprobados?: number;
    }

    let cert: CertificadoRow | null = null;

    const { data: byNum, error: numError } = await supabase
      .from('certificados_emitidos')
      .select('*')
      .or(`numero_certificado.eq.${cleanQuery},hash_sha256.eq.${cleanQuery}`)
      .maybeSingle();

    if (!numError && byNum) {
      cert = byNum as unknown as CertificadoRow;
    } else {
      // Fallback 1: Buscar directamente por hash
      const { data: byHash } = await supabase
        .from('certificados_emitidos')
        .select('*')
        .eq('hash_sha256', cleanQuery)
        .maybeSingle();

      if (byHash) {
        cert = byHash as unknown as CertificadoRow;
      } else if (cleanQuery.toUpperCase().startsWith('KMB-')) {
        // Fallback 2: Si viene en formato KMB-YYYY-XXXX-YYYY, buscar por prefijo de hash
        const parts = cleanQuery.split('-');
        if (parts.length >= 4) {
          const hashPrefix = (parts[2] + parts[3]).toLowerCase();
          const { data: byPrefix } = await supabase
            .from('certificados_emitidos')
            .select('*')
            .ilike('hash_sha256', `${hashPrefix}%`)
            .maybeSingle();
          if (byPrefix) {
            cert = byPrefix as unknown as CertificadoRow;
          }
        }
      }
    }

    if (!cert) {
      return {
        success: false,
        error: 'Certificado no encontrado o código de verificación no válido.',
      };
    }

    const { data: project } = await supabase
      .from('projects')
      .select('titulo')
      .eq('id', cert.project_id)
      .maybeSingle();

    const { data: profile } = await supabase
      .from('profiles')
      .select('nombre_completo')
      .eq('id', cert.profile_id)
      .maybeSingle();

    const { data: tareas } = await supabase
      .from('tareas')
      .select('id, titulo')
      .eq('id_proyecto', cert.project_id)
      .eq('quiz_aprobado', true);

    const numero =
      cert.numero_certificado ||
      `KMB-${new Date(cert.fecha_emision).getFullYear()}-${cert.hash_sha256.slice(0, 4).toUpperCase()}-${cert.hash_sha256.slice(4, 8).toUpperCase()}`;

    return {
      success: true,
      data: {
        id: cert.id,
        numeroCertificado: numero,
        hash_sha256: cert.hash_sha256,
        fecha_emision: cert.fecha_emision,
        horas_invertidas: Number(cert.horas_invertidas) || 1,
        temas_aprobados: Number(cert.temas_aprobados) || (tareas?.length ?? 1),
        tituloProyecto: project?.titulo || 'Proyecto Académico',
        nombreEstudiante: profile?.nombre_completo || 'Estudiante Komorebi',
        tareas: tareas || [],
      },
    };
  } catch (err) {
    console.error('Error verifying certificate:', err);
    return { success: false, error: 'Ocurrió un error al verificar el certificado.' };
  }
}
