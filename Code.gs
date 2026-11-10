/**
 * I.E. 5074 ALCIDES SPELUCÍN VEGA
 * Núcleo de Google Apps Script para la hoja de cálculo institucional.
 *
 * Este código valida estructura, genera códigos QR y registra PRESENTE.
 * No expone el padrón como API pública. No contiene un login de producción.
 * No clasifica tardanza/falta: falta confirmar el horario institucional vigente.
 */
const INSTITUCION = "I.E. 5074 Alcides Spelucín Vega";
const HOJAS = { ALUMNOS:"ALUMNOS", DOCENTES:"DOCENTES", ASISTENCIA:"ASISTENCIA", USUARIOS:"USUARIOS", CONFIG:"CONFIGURACIÓN" };
const ENCABEZADOS = {
  ALUMNOS:["CODIGO_ALUMNO","APELLIDOS_Y_NOMBRES","GRADO","SECCION","FOTO_URL","CODIGO_QR","ESTADO"],
  DOCENTES:["CODIGO_DOCENTE","APELLIDOS_Y_NOMBRES","DNI_DEMO","ESPECIALIDAD","GRADOS_Y_SECCIONES","USUARIO","CLAVE_DEMO","ESTADO"],
  ASISTENCIA:["ID_REGISTRO","CODIGO_ALUMNO","APELLIDOS_Y_NOMBRES","GRADO","SECCION","FECHA","HORA","ESTADO","TIPO_REGISTRO","OBSERVACIÓN"],
  USUARIOS:["CODIGO_USUARIO","USUARIO","ROL","CODIGO_DOCENTE","ESTADO","FECHA_CREACION","ULTIMO_ACCESO"],
  CONFIG:["PARAMETRO","VALOR","DESCRIPCION","ESTADO"]
};

function verificarEstructura(){
  const ss=SpreadsheetApp.getActiveSpreadsheet(), errores=[];
  Object.keys(ENCABEZADOS).forEach(n=>{
    const sh=ss.getSheetByName(n);
    if(!sh){errores.push("No existe la pestaña "+n);return;}
    const actual=sh.getRange(1,1,1,ENCABEZADOS[n].length).getDisplayValues()[0].map(x=>String(x).trim());
    ENCABEZADOS[n].forEach((h,i)=>{if(actual[i]!==h)errores.push(n+" columna "+(i+1)+": se esperaba "+h);});
  });
  const msg=errores.length?"OBSERVACIONES:\n"+errores.join("\n"):"Correcto: las cinco pestañas y sus encabezados están reconocidos.";
  SpreadsheetApp.getUi().alert(INSTITUCION+"\n\n"+msg);
  return {exito:!errores.length,errores};
}

function verificarPadronAlumnos(){
  const sh=SpreadsheetApp.getActive().getSheetByName(HOJAS.ALUMNOS);
  if(!sh)throw new Error("No existe ALUMNOS.");
  const d=sh.getDataRange().getDisplayValues(), ix=indices_(d[0],["CODIGO_ALUMNO","APELLIDOS_Y_NOMBRES","GRADO","SECCION"]);
  let total=0,incompletos=0,duplicados=0;const vistos=new Set();
  for(let i=1;i<d.length;i++){
    const f=d[i];if(!(f[ix.CODIGO_ALUMNO]||f[ix.APELLIDOS_Y_NOMBRES]))continue;
    total++;if(!f[ix.CODIGO_ALUMNO]||!f[ix.APELLIDOS_Y_NOMBRES]||!f[ix.GRADO]||!f[ix.SECCION])incompletos++;
    if(f[ix.CODIGO_ALUMNO]){if(vistos.has(f[ix.CODIGO_ALUMNO]))duplicados++;vistos.add(f[ix.CODIGO_ALUMNO]);}
  }
  SpreadsheetApp.getUi().alert("VERIFICACIÓN DEL PADRÓN\n\nEstudiantes: "+total+"\nIncompletos: "+incompletos+"\nCódigos duplicados: "+duplicados+"\nCantidad prevista: 395");
  return {total,incompletos,duplicados};
}

function generarCodigosQR(){
  const sh=SpreadsheetApp.getActive().getSheetByName(HOJAS.ALUMNOS);
  if(!sh)throw new Error("No existe ALUMNOS.");
  const d=sh.getDataRange().getDisplayValues();if(d.length<2)throw new Error("No hay estudiantes.");
  const ix=indices_(d[0],["CODIGO_ALUMNO","APELLIDOS_Y_NOMBRES","CODIGO_QR"]);
  let n=0;const out=[];
  for(let i=1;i<d.length;i++){let q=d[i][ix.CODIGO_QR];if(d[i][ix.CODIGO_ALUMNO]&&d[i][ix.APELLIDOS_Y_NOMBRES]&&!q){q="QR-"+Utilities.getUuid();n++;}out.push([q]);}
  sh.getRange(2,ix.CODIGO_QR+1,out.length,1).setValues(out);
  SpreadsheetApp.getUi().alert("Códigos QR nuevos generados: "+n);return n;
}

function crearTarjetasQR(){
  const ss=SpreadsheetApp.getActive(),al=ss.getSheetByName(HOJAS.ALUMNOS);
  if(!al)throw new Error("No existe ALUMNOS.");
  if(ss.getSheetByName("TARJETAS_QR"))throw new Error("Ya existe TARJETAS_QR. No se modificó.");
  const d=al.getDataRange().getDisplayValues(),ix=indices_(d[0],["CODIGO_ALUMNO","APELLIDOS_Y_NOMBRES","GRADO","SECCION","CODIGO_QR"]);
  const rows=[];
  for(let i=1;i<d.length;i++){const f=d[i];if(f[ix.CODIGO_ALUMNO]&&f[ix.APELLIDOS_Y_NOMBRES]&&f[ix.CODIGO_QR])rows.push([f[ix.CODIGO_ALUMNO],f[ix.APELLIDOS_Y_NOMBRES],f[ix.GRADO],f[ix.SECCION],f[ix.CODIGO_QR],""]);}
  if(!rows.length)throw new Error("No hay códigos QR. Ejecuta generarCodigosQR primero.");
  const out=ss.insertSheet("TARJETAS_QR");out.appendRow(["CODIGO_ALUMNO","APELLIDOS_Y_NOMBRES","GRADO","SECCION","CODIGO_QR","IMAGEN QR"]);
  out.getRange(2,1,rows.length,6).setValues(rows);
  out.getRange(2,6,rows.length,1).setFormulas(rows.map((r,i)=>['=IMAGE("https://quickchart.io/qr?text="&ENCODEURL(E'+(i+2)+')&"&size=180")']));
  out.setFrozenRows(1);out.setColumnWidth(2,280);out.setColumnWidth(5,300);out.setColumnWidth(6,150);out.setRowHeights(2,rows.length,140);
  out.getRange(1,1,1,6).setFontWeight("bold").setBackground("#0c8f52").setFontColor("#ffffff");
  SpreadsheetApp.getUi().alert("Tarjetas QR creadas: "+rows.length);
}

function buscarAlumnoPorQR(codigoQR){
  if(!codigoQR)return null;
  const sh=SpreadsheetApp.getActive().getSheetByName(HOJAS.ALUMNOS);
  if(!sh)throw new Error("No existe ALUMNOS.");
  const d=sh.getDataRange().getDisplayValues();
  const ix=indices_(d[0],["CODIGO_ALUMNO","APELLIDOS_Y_NOMBRES","GRADO","SECCION","FOTO_URL","CODIGO_QR","ESTADO"]);
  const q=String(codigoQR).trim();
  for(let i=1;i<d.length;i++){const f=d[i];if(f[ix.CODIGO_QR]===q)return {codigo:f[ix.CODIGO_ALUMNO],nombre:f[ix.APELLIDOS_Y_NOMBRES],grado:f[ix.GRADO],seccion:f[ix.SECCION],foto:f[ix.FOTO_URL],estado:f[ix.ESTADO]};}
  return null;
}

function registrarAsistenciaQR(codigoQR,observacion){
  const ss=SpreadsheetApp.getActive(),sh=ss.getSheetByName(HOJAS.ASISTENCIA);
  if(!sh)return {exito:false,mensaje:"No existe ASISTENCIA."};
  const lock=LockService.getScriptLock();
  try{
    lock.waitLock(10000);
    const a=buscarAlumnoPorQR(codigoQR);
    if(!a)return {exito:false,mensaje:"Código QR no reconocido."};
    if(String(a.estado).toUpperCase()!=="ACTIVO")return {exito:false,mensaje:"El estudiante no está activo."};
    const tz=ss.getSpreadsheetTimeZone()||"America/Lima",now=new Date();
    const fecha=Utilities.formatDate(now,tz,"yyyy-MM-dd"),hora=Utilities.formatDate(now,tz,"HH:mm:ss");
    const d=sh.getDataRange().getDisplayValues(),ix=indices_(d[0],ENCABEZADOS.ASISTENCIA);
    for(let i=1;i<d.length;i++)if(d[i][ix.CODIGO_ALUMNO]===a.codigo&&normalizarFecha_(d[i][ix.FECHA],tz)===fecha)return {exito:false,duplicado:true,mensaje:"El estudiante ya tiene un registro hoy.",alumno:a.nombre};
    const vals={ID_REGISTRO:Utilities.getUuid(),CODIGO_ALUMNO:a.codigo,APELLIDOS_Y_NOMBRES:a.nombre,GRADO:a.grado,SECCION:a.seccion,FECHA:fecha,HORA:hora,ESTADO:"PRESENTE",TIPO_REGISTRO:"QR","OBSERVACIÓN":observacion||""};
    const row=d[0].map(h=>Object.prototype.hasOwnProperty.call(vals,h)?vals[h]:"");sh.appendRow(row);
    return {exito:true,mensaje:"Asistencia registrada.",alumno:a.nombre,grado:a.grado,seccion:a.seccion,fecha,hora,estado:"PRESENTE"};
  }catch(e){return {exito:false,mensaje:"Error al registrar: "+e.message};}
  finally{if(lock.hasLock())lock.releaseLock();}
}

function indices_(headers,required){const o={};required.forEach(h=>{const i=headers.indexOf(h);if(i<0)throw new Error("Falta encabezado: "+h);o[h]=i;});return o;}
function normalizarFecha_(v,tz){if(v instanceof Date)return Utilities.formatDate(v,tz,"yyyy-MM-dd");const s=String(v||"").trim();if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);return m?m[3]+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0"):s;}
