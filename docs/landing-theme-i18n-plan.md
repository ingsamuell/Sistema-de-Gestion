# Plan: landing pública, temas e idiomas

## Estado y decisiones aprobadas

Este documento convierte los acuerdos del equipo en un plan de entrega para Komorebi.

- La landing pública ocupará `/`.
- La aplicación autenticada tendrá como inicio `/app`.
- La interfaz estará disponible en español e inglés bajo `/es` y `/en`.
- Habrá modo claro, modo oscuro y una opción que respete la preferencia del sistema.
- La preferencia explícita de idioma y tema se conservará entre visitas.
- La traducción cubre toda la interfaz visible: landing, autenticación, dashboard,
  páginas legales, metadatos, mensajes de interfaz y atributos accesibles.
- No se traducen datos creados por usuarios, como títulos de proyectos, ni respuestas
  generadas por IA. Sí se localizan fechas, números y textos propios de la aplicación.

## Objetivo

Ofrecer una presentación pública y bilingüe de Komorebi, manteniendo una experiencia
consistente en todas las pantallas, con temas claro y oscuro accesibles y sin romper los
flujos de autenticación ni la navegación existente.

## Arquitectura de rutas objetivo

Las páginas nuevas y migradas usarán un segmento de idioma. Las rutas públicas tendrán
una versión sin prefijo solo para preservar una entrada simple hacia la landing:

| Propósito          | Español               | Inglés               | Nota                                                    |
| ------------------ | --------------------- | -------------------- | ------------------------------------------------------- |
| Landing            | `/es`                 | `/en`                | `/` redirige o sirve la landing en el idioma preferido. |
| Inicio autenticado | `/es/app`             | `/en/app`            | Sustituye el actual dashboard en `/`.                   |
| Acceso             | `/es/login`           | `/en/login`          | Mantiene la pantalla y copy localizados.                |
| Registro           | `/es/registro`        | `/en/register`       | Ruta visible localizada.                                |
| Proyectos          | `/es/proyectos`       | `/en/projects`       | La misma funcionalidad con enlace localizado.           |
| Calendario         | `/es/calendario`      | `/en/calendar`       | La misma funcionalidad con enlace localizado.           |
| Analítica          | `/es/analitica`       | `/en/analytics`      | La misma funcionalidad con enlace localizado.           |
| Asistente          | `/es/ia`              | `/en/ai`             | La misma funcionalidad con enlace localizado.           |
| Perfil             | `/es/perfil`          | `/en/profile`        | La misma funcionalidad con enlace localizado.           |
| Certificaciones    | `/es/certificaciones` | `/en/certifications` | La misma funcionalidad con enlace localizado.           |
| Temas              | `/es/temas`           | `/en/topics`         | La misma funcionalidad con enlace localizado.           |
| Privacidad         | `/es/privacidad`      | `/en/privacy`        | Requiere revisión de la traducción legal.               |
| Términos           | `/es/terminos`        | `/en/terms`          | Requiere revisión de la traducción legal.               |

Las rutas actuales deberán redirigir a su equivalente español durante la transición.
El plan no elimina rutas existentes sin una redirección equivalente.

## Principios técnicos

### Internacionalización

- Usar un segmento de ruta para el idioma y una única fuente de verdad para los enlaces.
- Centralizar los mensajes por dominio: `marketing`, `navigation`, `auth`, `dashboard`,
  `projects`, `calendar`, `analytics`, `assistant`, `profile`, `certifications`, `legal`
  y `common`.
- Mantener los IDs de traducción estables y usar interpolación tipada para nombres,
  cantidades y fechas.
- Localizar títulos, descripciones, etiquetas ARIA, placeholders, toasts y estados vacíos.
- Implementar funciones de enlace que reciban una ruta conceptual y devuelvan la URL
  correcta según el idioma. Ningún componente debe construir manualmente URLs traducidas.
- Mostrar fechas, horas y números con la configuración regional correspondiente a `es`
  o `en`; no traducir el contenido privado de usuarios.

### Tema

- Convertir los colores de interfaz en tokens semánticos: fondo, superficie, texto,
  texto secundario, borde, foco, acciones, éxito, atención y error.
- Definir cada token para claro y oscuro, en lugar de aplicar clases oscuras aisladas.
- Usar una preferencia `system`, `light` o `dark`; la primera visita parte del sistema.
- Persistir la elección y aplicarla antes de pintar el contenido para evitar parpadeo.
- Revisar gráficas, calendario, modales, formularios, elementos con colores explícitos y
  exportaciones. Las exportaciones pueden conservar un esquema claro legible si se
  documenta como una decisión de formato.

### Landing

- Reflejar únicamente capacidades existentes: proyectos, calendario, estudio, analítica,
  IA contextual y certificaciones.
- Incluir encabezado, hero, funcionalidades, explicación de uso, CTA, pie legal y los
  recursos visuales de Chigüi ya disponibles.
- No publicar testimonios, métricas, integraciones o precios que no estén aprobados.
- Incluir metadata, Open Graph, idioma de documento, canonical y `hreflang` por idioma.

## Fases de ejecución

### Fase 0.1 — Preparación de rutas y contratos

1. Revisar la guía de Next.js instalada antes de cambiar las rutas.
2. Crear el mapa de rutas conceptuales y sus equivalentes `es`/`en`.
3. Diseñar los redireccionamientos desde las rutas actuales, incluidos `/` y los flujos
   posteriores a login, onboarding y cierre de sesión.
4. Identificar enlaces internos, `router.push`, `redirect` y metadata que usan rutas
   existentes.
5. Acordar el mecanismo concreto de internacionalización compatible con la versión
   instalada de Next.js antes de añadir dependencias.

**Criterio de salida:** mapa de rutas aprobado, redirecciones enumeradas y ningún flujo
crítico queda sin destino después de mover el dashboard.

### Fase 0.2 — Fundaciones compartidas

1. Crear los contratos de idioma, tema y ruta conceptual.
2. Preparar el proveedor de idioma y los diccionarios iniciales `es` y `en`.
3. Crear el proveedor de tema, los tokens semánticos y el control accesible de tema.
4. Crear el selector de idioma y el helper de enlaces localizados.
5. Migrar el layout raíz para que `lang`, metadata y tema provengan de los contratos
   anteriores.

**Criterio de salida:** una ruta de muestra puede cambiar idioma y tema, mantiene la
preferencia al recargar y no mezcla textos ni colores de otro modo.

### Fase 1 — Landing pública

1. Liberar `/` como entrada pública y mover el dashboard a `/app` dentro del nuevo
   esquema de idiomas.
2. Crear layout y componentes de marketing reutilizables.
3. Implementar la landing en ambos idiomas desde diccionarios, no con textos incrustados.
4. Conectar CTA de registro y acceso con las rutas localizadas.
5. Añadir metadata localizada y enlaces alternativos de idioma.

**Criterio de salida:** visitante no autenticado ve una landing completa y usable en
español o inglés; un usuario autenticado llega a su dashboard en `/es/app` o `/en/app`.

### Fase 2 — Modo claro y oscuro en toda la aplicación

1. Migrar componentes compartidos y layouts a tokens semánticos.
2. Auditar autenticación, dashboard, proyectos, calendario, analítica, IA, perfil,
   certificaciones, temas y legales.
3. Ajustar contrastes, foco de teclado, gráficas y componentes con colores codificados.
4. Comprobar persistencia y comportamiento con la preferencia del sistema.

**Criterio de salida:** cada pantalla es legible, navegable y visualmente coherente en
claro y oscuro, móvil y escritorio.

### Fase 3 — Traducción completa de interfaz

1. Migrar los textos por dominio, empezando por navegación y autenticación.
2. Traducir dashboard y funcionalidades por lotes pequeños: proyectos, calendario,
   analítica, IA, perfil, certificaciones y temas.
3. Traducir páginas legales tras revisión humana del contenido jurídico en inglés.
4. Localizar metadata, errores, toasts, accesibilidad y formato de fecha/número.
5. Validar que los cambios de idioma preserven la vista conceptual equivalente.

**Criterio de salida:** no hay textos de interfaz mezclados entre español e inglés y las
rutas, navegación y metadatos corresponden al idioma activo.

### Fase 4 — Validación y publicación

1. Corregir o aislar el problema del archivo generado `.next/dev/types/validator.ts` antes
   de atribuir fallas de tipos a los cambios funcionales.
2. Ejecutar `format:check`, `lint`, `typecheck` y `build` de forma separada.
3. Realizar revisión visual en español e inglés, claro y oscuro, móvil y escritorio.
4. Verificar registro, acceso, recuperación, onboarding, cierre de sesión y redirecciones.
5. Verificar metadata, canonical, `hreflang`, enlaces legales y rutas antiguas.

**Criterio de salida:** validaciones técnicas aprobadas y matriz visual completa para los
dos idiomas y los dos temas.

## Matriz mínima de aceptación

| Área                            | Español claro | Español oscuro | Inglés claro | Inglés oscuro |
| ------------------------------- | ------------- | -------------- | ------------ | ------------- |
| Landing y navegación pública    | Requerido     | Requerido      | Requerido    | Requerido     |
| Login, registro y recuperación  | Requerido     | Requerido      | Requerido    | Requerido     |
| Dashboard y navegación lateral  | Requerido     | Requerido      | Requerido    | Requerido     |
| Proyectos y calendario          | Requerido     | Requerido      | Requerido    | Requerido     |
| Analítica, IA y certificaciones | Requerido     | Requerido      | Requerido    | Requerido     |
| Perfil, temas y legales         | Requerido     | Requerido      | Requerido    | Requerido     |

## Riesgos a controlar

- Mover `/` impacta accesos posteriores a login, onboarding, enlaces del encabezado y
  enlaces legales; todos deben migrarse como una unidad.
- Las rutas con segmentos traducidos requieren un helper central para evitar URLs
  inconsistentes y enlaces manuales rotos.
- El modo oscuro no será fiable mientras haya colores incrustados en componentes.
- La traducción legal debe ser revisada por la persona responsable antes de presentarse
  como texto definitivo.
- La respuesta de IA y los datos privados no deben enviarse a servicios de traducción ni
  modificarse al cambiar el idioma de interfaz.
