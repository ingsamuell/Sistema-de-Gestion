export type LegalDocumentSection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  note?: string;
};

export type LegalDocument = {
  title: string;
  sections: LegalDocumentSection[];
};

export const termsDocument: LegalDocument = {
  title: 'Términos de uso del prototipo',
  sections: [
    {
      id: 'naturaleza',
      title: 'Naturaleza del proyecto',
      paragraphs: [
        'Komorebi Study Studio es un prototipo desarrollado por estudiantes con fines académicos y demostrativos. Explora herramientas de organización, planificación y apoyo al estudio, como proyectos, tareas, temas, horarios y funciones de asistencia.',
        'No es un servicio comercial ni sustituye plataformas institucionales oficiales. Las funciones, el diseño y las integraciones pueden cambiar, limitarse o dejar de estar disponibles durante el período de desarrollo y evaluación.',
      ],
    },
    {
      id: 'uso',
      title: 'Uso responsable',
      paragraphs: [
        'Al crear una cuenta o usar las funciones disponibles, reconoces que interactúas con un proyecto académico en desarrollo. Esperamos un uso respetuoso, lícito y relacionado con el estudio, la organización personal o la demostración académica.',
      ],
      bullets: [
        'No intentes acceder a cuentas, datos o funciones de otras personas.',
        'No introduzcas código malicioso, amenazas, hostigamiento o suplantación.',
        'No cargues contenido de terceros sin la autorización necesaria.',
        'No uses la Plataforma para facilitar plagio, fraude académico o trabajo ajeno.',
      ],
      note: 'El equipo puede retirar o limitar contenido incompatible con el propósito académico o con la convivencia de la actividad. Esto no implica una moderación automática de todos los campos.',
    },
    {
      id: 'cuenta',
      title: 'Cuenta y contenido aportado',
      paragraphs: [
        'Protege tus credenciales y no compartas tu contraseña. Los proyectos, tareas, notas, archivos y demás contenido que introduzcas siguen siendo de tu autoría o responsabilidad. Autorizas al equipo a almacenarlos y procesarlos únicamente para operar las funciones del prototipo.',
        'El onboarding inclusivo permite indicar de forma voluntaria preferencias de estudio, apoyos, intereses y, si lo decides, una referencia general a necesidades de aprendizaje. Elegir el recorrido estándar o no indicar esa información no limita el acceso a las funciones básicas.',
      ],
      note: 'No cargues información financiera, médica, clínica, confidencial, de terceros, credenciales ajenas ni archivos cuya pérdida pueda causarte un perjuicio relevante. Komorebi no solicita ni recibe diagnósticos, historiales clínicos ni documentos médicos en el onboarding inclusivo.',
    },
    {
      id: 'onboarding-inclusivo',
      title: 'Onboarding inclusivo y personalización',
      paragraphs: [
        'Las preferencias inclusivas se usan únicamente para adaptar el ritmo, formato y tipo de apoyo de la experiencia de estudio. No constituyen una evaluación, diagnóstico, tratamiento, recomendación médica o sustituto de profesionales de salud o educación.',
        'La información de este recorrido se guarda solo después de una confirmación expresa. No se transmite automáticamente a servicios de inteligencia artificial; cualquier función futura que requiera usarla deberá explicarlo y pedir una acción específica antes de hacerlo.',
        'Si respondes como familiar o cuidador, utiliza únicamente información necesaria para las preferencias de estudio y confirma que cuentas con autorización para aportarla. No incluyas datos identificables, clínicos o documentos de la persona estudiante.',
      ],
    },
    {
      id: 'integraciones',
      title: 'Funciones e integraciones opcionales',
      paragraphs: [
        'Algunas funciones pueden habilitarse solo para demostración o evaluación: asistencia con inteligencia artificial, conexión de solo lectura con Google Calendar o adjuntos de archivos. Si una función no está activa en la versión presentada, no forma parte del alcance del prototipo.',
        'El uso de una integración opcional es decisión de cada persona. Las respuestas de IA son orientativas y deben revisarse antes de utilizarlas; no sustituyen el criterio de docentes, instituciones o profesionales.',
      ],
    },
    {
      id: 'limites',
      title: 'Disponibilidad y límites',
      paragraphs: [
        'El equipo hará esfuerzos razonables para que el prototipo funcione durante la evaluación, pero no garantiza disponibilidad continua, ausencia de errores, compatibilidad con todos los dispositivos ni recuperación de información perdida.',
        'Conserva copias propias de todo material importante. No uses la Plataforma para entregas oficiales ni como respaldo único de archivos relevantes.',
      ],
    },
    {
      id: 'cambios',
      title: 'Cambios y dudas',
      paragraphs: [
        'Este documento puede actualizarse conforme evolucione el proyecto. La versión vigente mostrará su fecha de actualización. Si se habilita una integración nueva o cambia de forma relevante el uso de datos, actualizaremos también este aviso antes de presentarla.',
        'Las dudas pueden plantearse directamente al equipo durante la actividad académica o la demostración. El proyecto no ofrece un servicio de soporte comercial permanente.',
      ],
    },
  ],
};

export const privacyDocument: LegalDocument = {
  title: 'Privacidad durante la demostración',
  sections: [
    {
      id: 'proposito',
      title: 'Propósito de este aviso',
      paragraphs: [
        'Este aviso explica de forma simple qué información puede utilizar Komorebi Study Studio durante su desarrollo, demostración y evaluación académica. Es un prototipo, no una plataforma institucional oficial.',
      ],
    },
    {
      id: 'datos',
      title: 'Información que puede utilizarse',
      paragraphs: [
        'Dependiendo de las funciones activas, el prototipo puede utilizar información de cuenta, como nombre, correo y nombre de usuario; datos de perfil que decidas completar; y el contenido académico y de organización que introduzcas.',
      ],
      bullets: [
        'Datos de cuenta y perfil, como avatar, descripción o preferencias si decides completarlos.',
        'Proyectos, tareas, temas, fuentes, horarios, notas, archivos y métricas que tú mismo agregues.',
        'Datos técnicos básicos necesarios para mantener la sesión, detectar errores y proteger el acceso.',
        'Eventos de Google Calendar y mensajes o archivos usados en una consulta de IA, si activas esas funciones.',
        'Preferencias voluntarias del onboarding inclusivo, como formato de aprendizaje, ritmo, intereses o apoyos que deseas considerar.',
      ],
      note: 'No se recomienda registrar información financiera, médica, clínica, confidencial, de terceros o cualquier dato sensible dentro del prototipo. El onboarding inclusivo no acepta diagnósticos ni adjuntos médicos.',
    },
    {
      id: 'finalidad',
      title: 'Para qué se usa la información',
      paragraphs: [
        'La información se utiliza exclusivamente para el funcionamiento y la evaluación académica del prototipo.',
      ],
      bullets: [
        'Permitir el funcionamiento de la cuenta y de las funciones disponibles.',
        'Guardar y mostrar los proyectos, tareas y contenidos que crees.',
        'Preparar pruebas, demostraciones y evaluaciones académicas.',
        'Atender errores técnicos, prevenir usos indebidos y mejorar el proyecto durante el curso.',
        'Ejecutar integraciones opcionales que actives voluntariamente.',
      ],
      note: 'El proyecto no se desarrolla con fines de venta de datos ni publicidad personalizada.',
    },
    {
      id: 'preferencias-sensibles',
      title: 'Preferencias inclusivas y control de la persona usuaria',
      paragraphs: [
        'Algunas personas pueden considerar sensibles sus respuestas sobre atención, necesidades sensoriales o apoyos de aprendizaje. Por eso estas preguntas son voluntarias, se separan del onboarding estándar y requieren una confirmación antes de guardarse.',
        'No solicitamos, almacenamos ni procesamos documentos de diagnóstico, informes clínicos o historiales médicos. Las preferencias guardadas no se envían automáticamente a proveedores de IA ni se usan para tomar decisiones automatizadas sobre la persona usuaria.',
      ],
      note: 'Puedes elegir el plan estándar, omitir opciones opcionales y solicitar la eliminación de estas preferencias al equipo durante la actividad académica.',
    },
    {
      id: 'proveedores',
      title: 'Proveedores e integraciones',
      paragraphs: [
        'Para ejecutar las funciones mostradas, el proyecto puede utilizar servicios de alojamiento, autenticación, base de datos, almacenamiento, automatización, inteligencia artificial o integraciones externas. Cuando estén habilitados, pueden incluir Supabase, Vercel, Google Calendar, n8n y el proveedor de IA configurado por el equipo.',
        'Cada servicio procesa la información necesaria para la función que se active y se rige además por sus propios términos. Al utilizar IA, pueden enviarse tu mensaje y el contexto académico necesario para responder a esa solicitud; evita incluir datos confidenciales.',
      ],
    },
    {
      id: 'conservacion',
      title: 'Conservación y eliminación',
      paragraphs: [
        'La información puede conservarse mientras el prototipo esté activo para la actividad académica, durante pruebas razonables o mientras sea necesaria para evaluar su funcionamiento.',
        'Al finalizar el período académico, el equipo podrá eliminar datos de prueba, cuentas y contenido almacenado. No se garantiza una función de exportación, recuperación individual ni un plazo específico de eliminación; conserva siempre tus propios respaldos.',
      ],
    },
    {
      id: 'cuidado',
      title: 'Medidas de cuidado y dudas',
      paragraphs: [
        'El equipo aplica medidas razonables de autenticación, control de acceso y validación para reducir riesgos durante el desarrollo. Ningún prototipo garantiza seguridad absoluta o disponibilidad permanente.',
        'Protege tus credenciales, cierra sesión en dispositivos compartidos y evita introducir información sensible. Si necesitas corregir o eliminar información aportada al prototipo, comunícate con el equipo durante la actividad académica.',
      ],
    },
  ],
};
