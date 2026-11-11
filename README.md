# Sistema de Asistencia Escolar QR

Interfaz web para el control de asistencia de la I.E. N.° 5074 Alcides Spelucín Vega. Incluye dos perfiles de demostración: administrador y docente.

## Funciones

- Panel institucional con indicadores, gráficos, filtros y últimos registros.
- Panel docente con resumen del aula, escáner QR y directorio.
- Historial y exportación CSV compatible con Excel.
- Integración con Google Sheets mediante Google Apps Script.
- Diseño adaptable y tema oscuro azul.

## Ejecutar

1. Configura el backend siguiendo `README_INICIO_NUEVO_CHAT.txt`.
2. Actualiza la URL `/exec` de Apps Script en `app.js`.
3. Sirve la carpeta mediante HTTPS o `localhost` (necesario para usar la cámara).
4. Abre `panel.html`.

Credenciales de demostración: `admin / 1234` y `docente / 1234`. No usar estas credenciales en producción.

## Publicar en GitHub

1. Crea un repositorio **privado**.
2. Sube los archivos de esta carpeta, sin hojas de cálculo, fotos ni datos reales.
3. No publiques información personal de estudiantes menores de edad ni códigos QR.
4. Antes de producción, implementa autenticación y autorización en el servidor y restringe el acceso a la API.

## Esquema de datos

`ALUMNOS`: Código | Nombre | Foto | QR  
`ASISTENCIA`: Código | Nombre | Fecha | Hora | Estado

## Reglas horarias

- 07:40–07:59: ASISTENCIA
- 08:00–08:30: TARDANZA
- 08:31–12:40: FALTA
- Fuera de ese horario: FUERA DE HORARIO
- Sábados y domingos: SIN CLASES
- Un registro diario por código: DUPLICADO en escaneos posteriores

**Nota:** la versión actual registra `FALTA` cuando se escanea al estudiante dentro de ese intervalo. No crea automáticamente faltas para quienes no fueron escaneados.
