/*
 * Backend Google Apps Script vinculado al Google Sheets.
 * ALUMNOS: Código | Nombre | Foto | QR
 * ASISTENCIA: Código | Nombre | Fecha | Hora | Estado
 * Zona horaria del proyecto: America/Lima
 */
function doGet(e){
  const tipo=e&&e.parameter?e.parameter.tipo:"";
  if(tipo==="panel")return obtenerPanel();
  if(tipo==="alumnos")return obtenerAlumnos();
  const codigo=e&&e.parameter?String(e.parameter.codigo||"").trim():"";
  if(!codigo)return json({estado:"NO ENCONTRADO",mensaje:"No se recibió un código QR."});
  return registrarAsistencia(codigo);
}
function registrarAsistencia(codigo){
  const ss=SpreadsheetApp.getActiveSpreadsheet(),alumnos=ss.getSheetByName("ALUMNOS"),asistencia=ss.getSheetByName("ASISTENCIA");
  if(!alumnos||!asistencia)return json({estado:"ERROR",mensaje:"No se encontraron las hojas ALUMNOS y/o ASISTENCIA."});
  const ahora=new Date(),fecha=Utilities.formatDate(ahora,"America/Lima","yyyy-MM-dd"),hora=Utilities.formatDate(ahora,"America/Lima","HH:mm:ss");
  const estadoHorario=obtenerEstado(ahora);
  if(estadoHorario==="SIN CLASES"||estadoHorario==="FUERA DE HORARIO")return json({estado:estadoHorario,mensaje:"El registro no está permitido en este momento."});
  const filas=alumnos.getDataRange().getValues();let alumno=null;
  for(let i=1;i<filas.length;i++){if(String(filas[i][0]).trim()===codigo){alumno={codigo:String(filas[i][0]).trim(),nombre:String(filas[i][1]||""),foto:String(filas[i][2]||"")};break;}}
  if(!alumno)return json({estado:"NO ENCONTRADO",mensaje:"El código no está registrado en ALUMNOS."});
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    const registros=asistencia.getDataRange().getValues();
    for(let i=1;i<registros.length;i++){
      if(String(registros[i][0]).trim()===codigo&&String(registros[i][2]).trim()===fecha)
        return json({nombre:alumno.nombre,foto:alumno.foto,estado:"DUPLICADO",mensaje:"El estudiante ya tiene un registro para esta fecha."});
    }
    asistencia.appendRow([alumno.codigo,alumno.nombre,fecha,hora,estadoHorario]);
    return json({nombre:alumno.nombre,foto:alumno.foto,estado:estadoHorario,mensaje:"Asistencia registrada correctamente."});
  }finally{lock.releaseLock();}
}
function obtenerAlumnos(){
  const hoja=SpreadsheetApp.getActiveSpreadsheet().getSheetByName("ALUMNOS");
  if(!hoja)return json([]);
  const datos=hoja.getDataRange().getValues(),lista=[];
  for(let i=1;i<datos.length;i++){
    const codigo=String(datos[i][0]||"").trim();
    if(!codigo)continue;
    lista.push({codigo:codigo,nombre:String(datos[i][1]||""),foto:String(datos[i][2]||"")});
  }
  return json(lista);
}
function obtenerPanel(){
  const hoja=SpreadsheetApp.getActiveSpreadsheet().getSheetByName("ASISTENCIA");if(!hoja)return json([]);
  const datos=hoja.getDataRange().getValues(),lista=[];
  for(let i=1;i<datos.length;i++){
    lista.push({codigo:datos[i][0],nombre:datos[i][1],
      fecha:datos[i][2] instanceof Date?Utilities.formatDate(datos[i][2],"America/Lima","yyyy-MM-dd"):String(datos[i][2]||""),
      hora:datos[i][3] instanceof Date?Utilities.formatDate(datos[i][3],"America/Lima","HH:mm:ss"):String(datos[i][3]||""),
      estado:String(datos[i][4]||"")});
  }return json(lista);
}
function obtenerEstado(fechaHora){
  const dia=Number(Utilities.formatDate(fechaHora,"America/Lima","u"));if(dia>=6)return "SIN CLASES";
  const h=Number(Utilities.formatDate(fechaHora,"America/Lima","H")),m=Number(Utilities.formatDate(fechaHora,"America/Lima","m")),total=h*60+m;
  if(total<460||total>760)return "FUERA DE HORARIO";
  if(total<=479)return "ASISTENCIA";
  if(total<=510)return "TARDANZA";
  return "FALTA";
}
function json(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
