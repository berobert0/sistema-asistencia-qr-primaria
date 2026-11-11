# Sistema de Asistencia QR — I.E. N.° 5074 Alcides Spelucín Vega

Interfaz web adaptable para GitHub Pages, con backend Google Apps Script y Google Sheets. Incluye acceso por rol, panel institucional, panel de aula, lectura QR, historial y exportación CSV.

## 1. Estructura

- `index.html`: aplicación web (login y módulos).
- `styles.css`: interfaz responsive en modo oscuro.
- `app.js`: navegación, gráficos, escáner QR y llamadas a la API.
- `config.js`: URL de despliegue de Apps Script.
- `Code.gs`: backend, autenticación, permisos, validaciones y registro.
- `README.md`: instrucciones.

## 2. Antes de comenzar: respaldo

1. Duplica el archivo de Google Sheets que actualmente contiene los registros.
2. No borres ni reemplaces las hojas existentes.
3. Trabaja primero con una copia de prueba y datos ficticios.
4. Revisa los encabezados reales con `diagnosticoEstructura()` en Apps Script.

## 3. Estructura de Google Sheets

El backend utiliza estas hojas (los nombres deben coincidir):

### ALUMNOS
Encabezados requeridos: `Código`, `Nombre`, `Grado`, `Sección`.
Opcionales: `Foto`, `QR`, `Activo`.

Si tu hoja actual tiene `Código | Nombre | Foto | QR`, no elimines esos campos: agrega las columnas `Grado` y `Sección` al final y completa esos datos para cada estudiante. El código QR puede ser el código del alumno o el contenido que está guardado en la columna QR.

### DOCENTES
Encabezados requeridos: `CódigoDocente`, `Nombre`, `Grado`, `Sección`.
Opcional: `Activo`.
Cada docente debe tener un código único y una sola sección asignada. Si un docente atiende más de una sección, se debe ampliar el modelo de asignaciones antes de habilitarlo.

### ASISTENCIA
Encabezados requeridos: `Código`, `Nombre`, `Fecha`, `Hora`, `Estado`.
Opcionales: `Grado`, `Sección`, `Docente`.
El backend conserva el orden actual de las columnas. Si existen las columnas opcionales, también las completa. No borra registros.

### USUARIOS
Encabezados requeridos: `Usuario`, `ClaveHash`, `Rol`, `CódigoDocente`, `Activo`, `Nombre`.
`CódigoDocente` debe coincidir con el código de la hoja DOCENTES. Para el administrador puede quedar vacío. Roles admitidos: `ADMIN` y `DOCENTE`. `Activo`: `SI` o `NO`.

`ClaveHash` almacena el SHA-256 de la contraseña, no la contraseña escrita. Para generarlo, cambia temporalmente la clave en la función `generarHashClave()` de `Code.gs`, ejecuta esa función y copia el resultado del registro de ejecución a la celda `ClaveHash`. Usa contraseñas largas y únicas. Luego elimina la clave temporal del código.

### CONFIGURACIÓN
Opcional. Para el año escolar, puedes colocar dos columnas: `ANIO_ESCOLAR | 2026`.

## 4. Instalar Google Apps Script

1. Abre el Google Sheets de prueba.
2. Entra a **Extensiones → Apps Script**.
3. Reemplaza el contenido del archivo de código por `Code.gs`.
4. Guarda el proyecto y configura la zona horaria `America/Lima` en Configuración del proyecto.
5. Ejecuta `diagnosticoEstructura()` y revisa el registro. Esta función solo lee los nombres de hojas y encabezados.
6. Completa las hojas requeridas y crea usuarios de prueba.
7. Ve a **Implementar → Nueva implementación → Aplicación web**.
8. Ejecutar como: tu cuenta institucional propietaria del archivo. Quién tiene acceso: según la política institucional. No publiques datos de menores como acceso anónimo.
9. Copia la URL que termina en `/exec`.

## 5. Configurar la interfaz

En `config.js`, reemplaza el valor de `API_URL`:

```js
window.APP_CONFIG = { API_URL: "https://script.google.com/macros/s/TU_ID/exec" };
```

Sube todos los archivos al repositorio GitHub y habilita **Settings → Pages** para publicar desde la rama y carpeta elegidas. La cámara QR necesita HTTPS (GitHub Pages ya proporciona HTTPS) y permiso del navegador.

## 6. Reglas horarias incluidas

- Lunes a viernes, 07:40–07:59: `ASISTENCIA`.
- 08:00–08:30: `TARDANZA`.
- 08:31–12:40: `FALTA`.
- Antes de 07:40 o después de 12:40: `FUERA DE HORARIO` (no inserta registro).
- Sábados y domingos: `SIN CLASES`.
- Un solo registro por código y fecha. Un nuevo intento devuelve `DUPLICADO`.

Estas reglas se encuentran en `attendanceStatus_()` y deben ajustarse si la dirección define otro horario.

## 7. Permisos

- La validación del usuario se ejecuta en Apps Script.
- Cada solicitud de estudiantes, historial y escaneo vuelve a validar el token.
- El docente solo recibe estudiantes y registros de su grado/sección asignados en `DOCENTES`.
- El administrador consulta el conjunto institucional.
- No se debe confiar en los filtros de pantalla como mecanismo de seguridad.

## 8. Pruebas antes de producción

- Crear un administrador y dos docentes de prueba en secciones distintas.
- Verificar que el docente A no pueda consultar estudiantes ni registrar QR de la sección B.
- Probar QR válido, inexistente, duplicado y fuera de horario.
- Verificar que el registro se agrega al final de `ASISTENCIA` sin alterar filas anteriores.
- Confirmar que los totales y exportaciones coinciden con Sheets.
- Revisar la política institucional de protección de datos antes de usar información de estudiantes.

## 9. Nota técnica

La interfaz utiliza Chart.js y html5-qrcode desde CDN. Para uso real, fija versiones revisadas y considera alojar dependencias localmente. La primera conexión debe probarse desde el dominio GitHub Pages: algunas configuraciones de Google Apps Script pueden presentar restricciones CORS/redirecciones en solicitudes externas. Si ocurre, no desactives controles de seguridad ni hagas pública la hoja; revisaremos el transporte de la API y el despliegue.
