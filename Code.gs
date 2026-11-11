/**
 * SISTEMA DE ASISTENCIA QR - I.E. N.° 5074 ALCIDES SPELUCÍN VEGA
 * Google Apps Script vinculado al libro de Google Sheets.
 * Hojas esperadas: ALUMNOS, DOCENTES, ASISTENCIA, USUARIOS, CONFIGURACIÓN.
 * Este backend conserva los encabezados existentes y no borra ni reconstruye hojas.
 */
const APP = { TZ: 'America/Lima', SESSION_SECONDS: 21600, SHEETS: { students:'ALUMNOS', teachers:'DOCENTES', attendance:'ASISTENCIA', users:'USUARIOS', config:'CONFIGURACIÓN' } };

function doGet(e) {
  // Diagnóstico mínimo; las operaciones se procesan por POST.
  return output_({ ok:true, service:'Sistema de Asistencia QR', message:'API disponible. Utiliza POST desde la interfaz.' });
}
function doPost(e) {
  try {
    const p = parseRequest_(e);
    const action = String(p.action || '').trim();
    let result;
    switch (action) {
      case 'login': result = login_(p); break;
      case 'me': result = { ok:true, user: requireSession_(p.token).publicUser }; break;
      case 'logout': result = logout_(p.token); break;
      case 'dashboard': result = dashboard_(requireSession_(p.token)); break;
      case 'students': result = students_(requireSession_(p.token)); break;
      case 'teachers': result = teachers_(requireSession_(p.token)); break;
      case 'records': result = records_(requireSession_(p.token), p); break;
      case 'scan': result = scan_(requireSession_(p.token), p.code); break;
      default: result = { ok:false, message:'Acción no reconocida.' };
    }
    return output_(result);
  } catch (err) {
    const msg = String(err && err.message || err);
    return output_({ ok:false, errorCode: msg.indexOf('Sesión') >= 0 || msg.indexOf('autorizado') >= 0 ? 'UNAUTHORIZED' : 'SERVER_ERROR', message:msg });
  }
}
function parseRequest_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  const raw = e.postData.contents;
  if (e.postData.type && e.postData.type.indexOf('application/json') >= 0) return JSON.parse(raw);
  const out = {};
  raw.split('&').forEach(part => { const a=part.split('='); if(a.length) out[decodeURIComponent(a[0].replace(/\+/g,' '))]=decodeURIComponent((a.slice(1).join('=')||'').replace(/\+/g,' ')); });
  return out;
}
function output_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function book_() { const ss=SpreadsheetApp.getActiveSpreadsheet(); if(!ss) throw new Error('No se encontró el Google Sheets vinculado al proyecto.'); return ss; }
function sheet_(name) { const sh=book_().getSheetByName(name); if(!sh) throw new Error('No existe la hoja '+name+'. No se ha creado ni modificado ninguna hoja automáticamente.'); return sh; }
function norm_(v) { return String(v == null ? '' : v).trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' '); }
function headers_(sh) { const n=sh.getLastColumn(); if(!n) throw new Error('La hoja '+sh.getName()+' no tiene encabezados.'); return sh.getRange(1,1,1,n).getDisplayValues()[0].map(norm_); }
function col_(headers, aliases, required) { for(let i=0;i<aliases.length;i++){const k=norm_(aliases[i]);const at=headers.indexOf(k);if(at>=0)return at;} if(required) throw new Error('Falta una columna requerida: '+aliases[0]); return -1; }
function rows_(name) { const sh=sheet_(name), values=sh.getDataRange().getValues(), display=sh.getDataRange().getDisplayValues(); return {sh, headers:headers_(sh), values, display}; }
function val_(row, headers, aliases, fallback) { const i=col_(headers,aliases,false); return i<0 ? (fallback == null ? '' : fallback) : row[i]; }
function active_(v) { const x=norm_(v); return !['NO','0','FALSO','INACTIVO','INACTIVE'].includes(x); }
function hash_(text) { const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(text),Utilities.Charset.UTF_8); return bytes.map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join(''); }
function login_(p) {
  const username=String(p.username||'').trim(), passwordHash=String(p.passwordHash||'').toLowerCase();
  if(!username || !/^[a-f0-9]{64}$/.test(passwordHash)) throw new Error('Usuario o contraseña no válidos.');
  const t=rows_(APP.SHEETS.users), cUser=col_(t.headers,['Usuario','Username','Login'],true), cHash=col_(t.headers,['ClaveHash','PasswordHash','HashClave'],true), cRole=col_(t.headers,['Rol','Role','TipoUsuario'],true), cCode=col_(t.headers,['CodigoDocente','Código Docente','IdDocente','Codigo'],false), cActive=col_(t.headers,['Activo','Estado','Active'],false), cName=col_(t.headers,['Nombre','Nombres','NombreCompleto'],false);
  let found=null;
  for(let i=1;i<t.values.length;i++) if(String(t.values[i][cUser]).trim().toLowerCase()===username.toLowerCase()){found={row:t.values[i],display:t.display[i],index:i};break;}
  if(!found || !active_(cActive<0?'SI':found.row[cActive]) || String(found.row[cHash]).trim().toLowerCase()!==passwordHash) throw new Error('Usuario o contraseña incorrectos.');
  const role=norm_(found.row[cRole]); const isAdmin=['ADMIN','ADMINISTRADOR'].includes(role); if(!isAdmin && !['DOCENTE','TEACHER'].includes(role)) throw new Error('El rol del usuario no está habilitado.');
  let teacher=null;
  if(!isAdmin){const code=cCode<0?'':String(found.row[cCode]).trim(); if(!code) throw new Error('El usuario docente no tiene un código de docente asignado.'); teacher=findTeacherByCode_(code); if(!teacher || !teacher.active) throw new Error('No se encontró un docente activo para este usuario.'); if(!teacher.grade || !teacher.section) throw new Error('El docente no tiene grado y sección asignados.');}
  const token=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');
  const publicUser={username:String(found.row[cUser]),name:String(cName>=0&&found.row[cName]?found.row[cName]:(teacher?teacher.name:found.row[cUser])),role:isAdmin?'ADMIN':'DOCENTE',grade:teacher?teacher.grade:'',section:teacher?teacher.section:'',teacherCode:teacher?teacher.code:'',schoolYear:getSetting_('ANIO_ESCOLAR',new Date().getFullYear())};
  CacheService.getScriptCache().put('SESSION_'+token,JSON.stringify({publicUser:publicUser,created:Date.now()}),APP.SESSION_SECONDS);
  return {ok:true,token:token,user:publicUser};
}
function requireSession_(token) { if(!token) throw new Error('Sesión no válida. Inicia sesión nuevamente.'); const raw=CacheService.getScriptCache().get('SESSION_'+String(token)); if(!raw) throw new Error('Sesión vencida. Inicia sesión nuevamente.'); return JSON.parse(raw); }
function logout_(token) { if(token) CacheService.getScriptCache().remove('SESSION_'+String(token)); return {ok:true,message:'Sesión cerrada.'}; }
function findTeacherByCode_(code) {
  const t=rows_(APP.SHEETS.teachers), cCode=col_(t.headers,['CodigoDocente','Código Docente','Codigo','Código','IdDocente'],true), cName=col_(t.headers,['Nombre','Nombres','Docente','NombreCompleto'],true), cGrade=col_(t.headers,['Grado','Año','NivelGrado'],true), cSection=col_(t.headers,['Seccion','Sección','Letra'],true), cActive=col_(t.headers,['Activo','Estado'],false);
  for(let i=1;i<t.values.length;i++) if(String(t.values[i][cCode]).trim()===String(code).trim()) return {code:String(t.values[i][cCode]),name:String(t.values[i][cName]),grade:grade_(t.values[i][cGrade]),section:String(t.values[i][cSection]).trim().toUpperCase(),active:active_(cActive<0?'SI':t.values[i][cActive])};
  return null;
}
function isAdmin_(session) { return ['ADMIN','ADMINISTRADOR'].includes(norm_(session.publicUser.role)); }
function assertClass_(session, student) { if(!isAdmin_(session) && (String(student.grade)!==String(session.publicUser.grade) || norm_(student.section)!==norm_(session.publicUser.section))) throw new Error('No tienes permiso para consultar o registrar estudiantes de otra sección.'); }
function grade_(v) { const s=String(v==null?'':v).trim(); const m=s.match(/[1-6]/); return m?m[0]:s.replace(/[^0-9]/g,''); }
function getStudents_() {
  const t=rows_(APP.SHEETS.students), cCode=col_(t.headers,['Codigo','Código','CodigoAlumno','Código Alumno','ID'],true), cName=col_(t.headers,['Nombre','Nombres','Estudiante','NombreCompleto'],true), cPhoto=col_(t.headers,['Foto','Fotografia','URLFoto'],false), cQr=col_(t.headers,['QR','CodigoQR','Código QR'],false), cGrade=col_(t.headers,['Grado','Año','NivelGrado'],true), cSection=col_(t.headers,['Seccion','Sección','Letra'],true), cActive=col_(t.headers,['Activo','Estado'],false);
  return t.values.slice(1).map((r,i)=>({code:String(r[cCode]).trim(),name:String(r[cName]).trim(),photo:cPhoto<0?'':String(r[cPhoto]||''),qr:cQr<0?'':String(r[cQr]||''),grade:grade_(r[cGrade]),section:String(r[cSection]||'').trim().toUpperCase(),active:active_(cActive<0?'SI':r[cActive]),row:i+2})).filter(x=>x.code&&x.name&&x.active);
}
function students_(session) { let list=getStudents_(); if(!isAdmin_(session)) list=list.filter(x=>String(x.grade)===String(session.publicUser.grade)&&norm_(x.section)===norm_(session.publicUser.section)); return {ok:true,items:list.map(({row,...x})=>x)}; }
function teachers_(session) { if(!isAdmin_(session)) throw new Error('No estás autorizado para consultar el padrón de docentes.'); const t=rows_(APP.SHEETS.teachers), cCode=col_(t.headers,['CodigoDocente','Código Docente','Codigo','Código','IdDocente'],true), cName=col_(t.headers,['Nombre','Nombres','Docente','NombreCompleto'],true), cGrade=col_(t.headers,['Grado','Año','NivelGrado'],true), cSection=col_(t.headers,['Seccion','Sección','Letra'],true), cActive=col_(t.headers,['Activo','Estado'],false); const list=t.values.slice(1).map(r=>({code:String(r[cCode]),name:String(r[cName]),grade:grade_(r[cGrade]),section:String(r[cSection]).toUpperCase(),active:active_(cActive<0?'SI':r[cActive])})).filter(x=>x.code&&x.name); return {ok:true,items:list}; }
function attendanceRows_() {
  const t=rows_(APP.SHEETS.attendance), cCode=col_(t.headers,['Codigo','Código','CodigoAlumno','Código Alumno'],true), cName=col_(t.headers,['Nombre','Estudiante','Nombres'],true), cDate=col_(t.headers,['Fecha','Date'],true), cTime=col_(t.headers,['Hora','Time'],true), cStatus=col_(t.headers,['Estado','Status'],true), cGrade=col_(t.headers,['Grado','Año'],false), cSection=col_(t.headers,['Seccion','Sección'],false), cTeacher=col_(t.headers,['Docente','NombreDocente'],false);
  const dateFmt=v=>v instanceof Date?Utilities.formatDate(v,APP.TZ,'yyyy-MM-dd'):String(v||'').trim(); const timeFmt=v=>v instanceof Date?Utilities.formatDate(v,APP.TZ,'HH:mm:ss'):String(v||'').trim();
  const students=getStudents_(), byCode={};students.forEach(s=>byCode[s.code]=s);
  const items=t.values.slice(1).map(r=>{const code=String(r[cCode]).trim(),st=byCode[code]||{};return {code:code,name:String(r[cName]||''),date:dateFmt(r[cDate]),time:timeFmt(r[cTime]),status:String(r[cStatus]||''),grade:cGrade<0?(st.grade||''):grade_(r[cGrade]),section:cSection<0?(st.section||''):String(r[cSection]||'').toUpperCase(),teacher:cTeacher<0?'':String(r[cTeacher]||'')};}).filter(x=>x.code);
  return {sheet:t.sh,headers:t.headers,items,columns:{code:cCode,name:cName,date:cDate,time:cTime,status:cStatus,grade:cGrade,section:cSection,teacher:cTeacher}};
}
function records_(session,p) { let list=attendanceRows_().items; if(!isAdmin_(session))list=list.filter(x=>String(x.grade)===String(session.publicUser.grade)&&norm_(x.section)===norm_(session.publicUser.section)); const limit=Math.min(Math.max(Number(p.limit||500),1),2000); list.sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.time||'').localeCompare(a.time||'')); return {ok:true,items:list.slice(0,limit)}; }
function today_(){return Utilities.formatDate(new Date(),APP.TZ,'yyyy-MM-dd');}
function dashboard_(session) {
  const students=getStudents_().filter(s=>isAdmin_(session)||(String(s.grade)===String(session.publicUser.grade)&&norm_(s.section)===norm_(session.publicUser.section)));
  const attendance=attendanceRows_().items.filter(x=>x.date===today_()&&(isAdmin_(session)||(String(x.grade)===String(session.publicUser.grade)&&norm_(x.section)===norm_(session.publicUser.section))));
  const summary={students:students.length,teachers:isAdmin_(session)?teachers_(session).items.filter(x=>x.active).length:0,present:attendance.filter(x=>norm_(x.status)==='ASISTENCIA').length,late:attendance.filter(x=>norm_(x.status)==='TARDANZA').length,absent:attendance.filter(x=>norm_(x.status)==='FALTA').length}; summary.rate=students.length?Math.round((summary.present+summary.late)*1000/students.length)/10:0;
  const byClass=[]; if(isAdmin_(session)){for(let g=1;g<=6;g++)['A','B','C'].forEach(sec=>{const list=attendance.filter(x=>String(x.grade)===String(g)&&norm_(x.section)===sec);byClass.push({grade:g,section:sec,present:list.filter(x=>norm_(x.status)==='ASISTENCIA').length,late:list.filter(x=>norm_(x.status)==='TARDANZA').length});});}else byClass.push({grade:session.publicUser.grade,section:session.publicUser.section,present:summary.present,late:summary.late});
  const trend=[];for(let d=6;d>=0;d--){const date=new Date();date.setDate(date.getDate()-d);const key=Utilities.formatDate(date,APP.TZ,'yyyy-MM-dd');const label=Utilities.formatDate(date,APP.TZ,'dd MMM');const day=attendanceRows_().items.filter(x=>x.date===key&&(isAdmin_(session)||(String(x.grade)===String(session.publicUser.grade)&&norm_(x.section)===norm_(session.publicUser.section))));const count=day.filter(x=>['ASISTENCIA','TARDANZA'].includes(norm_(x.status))).length;trend.push({label,rate:students.length?Math.round(count*1000/students.length)/10:0});}
  return {ok:true,summary,byClass,trend};
}
function scan_(session,code) {
  code=String(code||'').trim();if(!code)throw new Error('No se recibió el código QR.');const student=getStudents_().find(s=>s.code===code||s.qr===code);if(!student)return {ok:true,status:'NO ENCONTRADO',message:'El código no está registrado en el padrón.'};assertClass_(session,student);
  const now=new Date(),status=attendanceStatus_(now);if(status==='SIN CLASES'||status==='FUERA DE HORARIO')return {ok:true,status,message:'El registro no está permitido en este horario.',name:student.name};
  const lock=LockService.getScriptLock();lock.waitLock(10000);try{const all=attendanceRows_();const duplicate=all.items.some(x=>x.code===student.code&&x.date===today_());if(duplicate)return {ok:true,status:'DUPLICADO',message:'El estudiante ya tiene un registro para esta fecha.',name:student.name};
    const row=new Array(all.headers.length).fill('');const c=all.columns;row[c.code]=student.code;row[c.name]=student.name;row[c.date]=today_();row[c.time]=Utilities.formatDate(now,APP.TZ,'HH:mm:ss');row[c.status]=status;if(c.grade>=0)row[c.grade]=student.grade;if(c.section>=0)row[c.section]=student.section;if(c.teacher>=0)row[c.teacher]=session.publicUser.name;all.sheet.appendRow(row);return {ok:true,status,message:'Asistencia registrada correctamente.',name:student.name,grade:student.grade,section:student.section};
  }finally{lock.releaseLock();}
}
function attendanceStatus_(date) { const day=Number(Utilities.formatDate(date,APP.TZ,'u'));if(day>=6)return 'SIN CLASES';const hm=Utilities.formatDate(date,APP.TZ,'HH:mm').split(':').map(Number),m=hm[0]*60+hm[1];if(m<460||m>760)return 'FUERA DE HORARIO';if(m<=479)return 'ASISTENCIA';if(m<=510)return 'TARDANZA';return 'FALTA'; }
function getSetting_(key,fallback) { try { const sh=book_().getSheetByName(APP.SHEETS.config);if(!sh)return fallback;const v=sh.getDataRange().getValues();for(let i=0;i<v.length;i++)if(norm_(v[i][0])===norm_(key))return v[i][1]||fallback; }catch(e){} return fallback; }

/** Ejecutar manualmente desde Apps Script para obtener el hash de una clave nueva. */
function generarHashClave() { const clave='CAMBIA_ESTA_CLAVE'; Logger.log(hash_(clave)); }
/** Ejecutar manualmente para comprobar nombres de hojas y encabezados sin modificar datos. */
function diagnosticoEstructura() { const ss=book_();const result={spreadsheet:ss.getName(),sheets:{}};Object.keys(APP.SHEETS).forEach(k=>{const name=APP.SHEETS[k],sh=ss.getSheetByName(name);result.sheets[name]=sh?sh.getRange(1,1,1,Math.max(1,sh.getLastColumn())).getDisplayValues()[0]: 'NO ENCONTRADA';});Logger.log(JSON.stringify(result,null,2));return result; }
