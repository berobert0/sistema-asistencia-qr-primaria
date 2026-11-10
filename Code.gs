/**
 * SISTEMA DE ASISTENCIA QR - I.E. 5074 ALCIDES SPELUCÍN VEGA
 * Backend para ejecutar como aplicación web de Google Apps Script.
 * IMPORTANTE: hacer copia del Code.gs actual antes de reemplazarlo.
 */
const CFG = {
  SPREADSHEET_ID: '', // Dejar vacío si este proyecto está vinculado al Google Sheets.
  TZ: 'America/Lima',
  ADMIN_USER: '42764301',
  ADMIN_NAME: 'EGUSQUIZA CONTRERAS ROBERT GREGORY',
  ADMIN_INITIAL_PASSWORD: '42764301',
  SHEETS: {
    ALUMNOS: 'ALUMNOS',
    DOCENTES: 'DOCENTES',
    ASISTENCIA: 'ASISTENCIA',
    USUARIOS: 'USUARIOS',
    CONFIG: 'CONFIGURACIÓN'
  },
  SESSION_HOURS: 8
};

function ss_() {
  return CFG.SPREADSHEET_ID
    ? SpreadsheetApp.openById(CFG.SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}
function sheet_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('No existe la hoja: ' + name);
  return sh;
}
function headers_(sh) {
  if (sh.getLastColumn() < 1) return [];
  return sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0].map(x=>String(x).trim());
}
function col_(headers, name) {
  const i = headers.indexOf(name);
  if (i < 0) throw new Error('Falta la columna ' + name);
  return i;
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Asistencia QR | I.E. 5074')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Ejecutar UNA SOLA VEZ desde Apps Script antes de publicar. */
function configurarSistemaInicial() {
  const required = Object.values(CFG.SHEETS);
  const missing = required.filter(n => !ss_().getSheetByName(n));
  if (missing.length) throw new Error('Faltan estas hojas: ' + missing.join(', '));
  const sh = sheet_(CFG.SHEETS.USUARIOS);
  const h = headers_(sh);
  ['CODIGO_USUARIO','USUARIO','ROL','CODIGO_DOCENTE','ESTADO','FECHA_CREACION','ULTIMO_ACCESO']
    .forEach(x => { if (!h.includes(x)) throw new Error('Falta encabezado en USUARIOS: '+x); });

  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('AUTH_SALT')) {
    props.setProperty('AUTH_SALT', Utilities.getUuid() + Utilities.getUuid());
  }
  const salt = props.getProperty('AUTH_SALT');
  const key = 'PWD_' + CFG.ADMIN_USER;
  if (!props.getProperty(key)) {
    props.setProperty(key, hashPassword_(CFG.ADMIN_INITIAL_PASSWORD, salt));
  }
  const values = sh.getDataRange().getDisplayValues();
  const exists = values.slice(1).some(r => r[h.indexOf('USUARIO')] === CFG.ADMIN_USER);
  if (!exists) {
    const row = new Array(h.length).fill('');
    row[h.indexOf('CODIGO_USUARIO')] = 'USR-ADMIN-001';
    row[h.indexOf('USUARIO')] = CFG.ADMIN_USER;
    row[h.indexOf('ROL')] = 'ADMIN';
    row[h.indexOf('CODIGO_DOCENTE')] = '';
    row[h.indexOf('ESTADO')] = 'ACTIVO';
    row[h.indexOf('FECHA_CREACION')] = new Date();
    sh.appendRow(row);
  }
  return 'Configuración inicial correcta. Usuario administrador creado.';
}
function hashPassword_(password, salt) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + '|' + password,
    Utilities.Charset.UTF_8
  );
  return bytes.map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}
function login(usuario, password) {
  usuario = String(usuario || '').trim();
  password = String(password || '');
  if (!usuario || !password) return {ok:false, message:'Ingresa usuario y contraseña.'};
  const props = PropertiesService.getScriptProperties();
  const salt = props.getProperty('AUTH_SALT');
  if (!salt) return {ok:false, message:'El administrador aún no ha ejecutado la configuración inicial.'};
  const expected = props.getProperty('PWD_' + usuario);
  if (!expected || hashPassword_(password, salt) !== expected) {
    Utilities.sleep(500);
    return {ok:false, message:'Usuario o contraseña incorrectos.'};
  }
  const sh = sheet_(CFG.SHEETS.USUARIOS), h = headers_(sh);
  const data = sh.getDataRange().getDisplayValues();
  const ui = h.indexOf('USUARIO'), ei = h.indexOf('ESTADO'), ri = h.indexOf('ROL');
  const rowIndex = data.findIndex((r,i)=>i>0 && r[ui]===usuario);
  if (rowIndex < 1 || String(data[rowIndex][ei]).toUpperCase() !== 'ACTIVO')
    return {ok:false, message:'La cuenta está inactiva o no está registrada.'};
  const token = Utilities.getUuid() + Utilities.getUuid();
  const user = {usuario, rol:data[rowIndex][ri], nombre: usuario===CFG.ADMIN_USER ? CFG.ADMIN_NAME : usuario};
  CacheService.getScriptCache().put('SESSION_'+token, JSON.stringify(user), CFG.SESSION_HOURS*3600);
  const lastCol = h.indexOf('ULTIMO_ACCESO');
  if (lastCol >= 0) sh.getRange(rowIndex+1,lastCol+1).setValue(new Date());
  return {ok:true, token, user};
}
function logout(token) {
  if (token) CacheService.getScriptCache().remove('SESSION_'+token);
  return {ok:true};
}
function auth_(token) {
  const raw = CacheService.getScriptCache().get('SESSION_'+String(token||''));
  if (!raw) throw new Error('Sesión vencida. Vuelve a iniciar sesión.');
  return JSON.parse(raw);
}
function obtenerResumen(token) {
  const user = auth_(token);
  const sh = sheet_(CFG.SHEETS.ASISTENCIA), h = headers_(sh);
  const rows = sh.getLastRow()>1 ? sh.getRange(2,1,sh.getLastRow()-1,h.length).getValues() : [];
  const idx = n => h.indexOf(n);
  const today = Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd');
  const f = idx('FECHA'), e = idx('ESTADO');
  const todays = rows.filter(r => {
    const d = r[f] instanceof Date ? Utilities.formatDate(r[f],CFG.TZ,'yyyy-MM-dd') : String(r[f]).slice(0,10);
    return d === today;
  });
  const count = s => todays.filter(r=>String(r[e]).toUpperCase()===s).length;
  const students = sheet_(CFG.SHEETS.ALUMNOS).getLastRow()-1;
  return {ok:true,user,fecha:today,totalEstudiantes:Math.max(0,students),
    registros: todays.length, presentes:count('PRESENTE'), tardanzas:count('TARDANZA'), faltas:count('FALTA')};
}
function buscarAlumno(token, codigo) {
  auth_(token);
  const sh = sheet_(CFG.SHEETS.ALUMNOS), h = headers_(sh);
  const rows = sh.getDataRange().getDisplayValues();
  const cCode = col_(h,'CODIGO_ALUMNO'), cQr = h.indexOf('CODIGO_QR');
  const found = rows.slice(1).find(r=>r[cCode]===String(codigo) || (cQr>=0 && r[cQr]===String(codigo)));
  if (!found) return {ok:false,message:'No se encontró el código del estudiante.'};
  const obj = {};
  ['CODIGO_ALUMNO','APELLIDOS_Y_NOMBRES','GRADO','SECCION','FOTO_URL','CODIGO_QR','ESTADO']
    .forEach(k=>{const i=h.indexOf(k); if(i>=0)obj[k]=found[i];});
  return {ok:true,alumno:obj};
}
function registrarAsistencia(token, codigo) {
  const user = auth_(token);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const found = buscarAlumno(token,codigo);
    if (!found.ok) return found;
    const a = found.alumno;
    if (String(a.ESTADO||'ACTIVO').toUpperCase()!=='ACTIVO')
      return {ok:false,message:'El estudiante no está activo.'};
    const sh = sheet_(CFG.SHEETS.ASISTENCIA), h = headers_(sh);
    const today = Utilities.formatDate(new Date(),CFG.TZ,'yyyy-MM-dd');
    const code = a.CODIGO_ALUMNO;
    const vals = sh.getLastRow()>1 ? sh.getRange(2,1,sh.getLastRow()-1,h.length).getValues() : [];
    const ci = h.indexOf('CODIGO_ALUMNO'), fi=h.indexOf('FECHA');
    const duplicate = vals.some(r=>{
      const d = r[fi] instanceof Date ? Utilities.formatDate(r[fi],CFG.TZ,'yyyy-MM-dd') : String(r[fi]).slice(0,10);
      return String(r[ci])===code && d===today;
    });
    if (duplicate) return {ok:false,duplicate:true,alumno:a,message:'Este estudiante ya tiene registro hoy.'};
    const now = new Date(), row = new Array(h.length).fill('');
    const put=(name,value)=>{const i=h.indexOf(name);if(i>=0)row[i]=value;};
    put('ID_REGISTRO',Utilities.getUuid());
    put('CODIGO_ALUMNO',code);
    put('APELLIDOS_Y_NOMBRES',a.APELLIDOS_Y_NOMBRES);
    put('GRADO',a.GRADO); put('SECCION',a.SECCION);
    put('FECHA',today);
    put('HORA',Utilities.formatDate(now,CFG.TZ,'HH:mm:ss'));
    put('ESTADO','PRESENTE');
    put('TIPO_REGISTRO','QR');
    put('OBSERVACIÓN','Registrado por '+user.usuario);
    sh.appendRow(row);
    return {ok:true,alumno:a,estado:'PRESENTE',hora:Utilities.formatDate(now,CFG.TZ,'HH:mm:ss'),message:'Asistencia registrada correctamente.'};
  } finally { lock.releaseLock(); }
}
function listarAsistencias(token) {
  auth_(token);
  const sh=sheet_(CFG.SHEETS.ASISTENCIA), h=headers_(sh);
  const data=sh.getDataRange().getDisplayValues();
  return {ok:true,headers:h,rows:data.slice(1).reverse().slice(0,300)};
}
