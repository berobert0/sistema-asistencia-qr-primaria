/* Módulo de escaneo QR compartido por el panel docente y administrador. */
const API = "https://script.google.com/macros/s/AKfycbwZKYugFQQjO6sb9MLSkMhETq4v-nHqgYzs45J4tRdYWW3AGIThbmW2TAPl1xv7X8z-SQ/exec";
let qrInstances = {}, scanLock = false;
function showScanResult(targetId, data){
 const target=document.getElementById(targetId); if(!target)return;
 const labels={ASISTENCIA:"✓ Asistencia registrada",TARDANZA:"◷ Tardanza registrada",FALTA:"× Falta registrada",DUPLICADO:"! Registro duplicado", "FUERA DE HORARIO":"Fuera de horario","SIN CLASES":"Sin clases","NO ENCONTRADO":"Código no registrado"};
 target.textContent=`${labels[data.estado]||data.estado||"Resultado"} · ${data.nombre||"Estudiante no identificado"}. ${data.mensaje||""}`;
 target.className="scan-result "+(data.estado==="ASISTENCIA"?"success":data.estado==="FALTA"?"danger":"");
}
async function registrarCodigoQR(codigo, targetId){
 if(scanLock)return;scanLock=true;
 try{const response=await fetch(`${API}?codigo=${encodeURIComponent(codigo)}`);if(!response.ok)throw Error("HTTP "+response.status);const data=await response.json();showScanResult(targetId,data);if(navigator.vibrate)navigator.vibrate(data.estado==="ASISTENCIA"?100:250);if(window.actualizarPanel)await window.actualizarPanel();}
 catch(error){console.error(error);showScanResult(targetId,{estado:"ERROR",mensaje:"No se pudo conectar con el servidor. Verifica Internet y Apps Script."});}
 finally{setTimeout(()=>scanLock=false,1600);}
}
async function startQRScanner(elementId,statusId,resultId){
 if(typeof Html5Qrcode==="undefined"){const s=document.getElementById(statusId);if(s)s.textContent="No se cargó la biblioteca del escáner. Revisa tu conexión.";return;}
 const status=document.getElementById(statusId);if(qrInstances[elementId]){status.textContent="La cámara ya está activa.";return;}
 try{const scanner=new Html5Qrcode(elementId);qrInstances[elementId]=scanner;await scanner.start({facingMode:"environment"},{fps:10,qrbox:{width:230,height:230}},text=>registrarCodigoQR(text,resultId),()=>{});if(status)status.textContent="Cámara activa. Enfoca el código QR del estudiante.";}
 catch(e){console.error(e);delete qrInstances[elementId];if(status)status.textContent="No se pudo iniciar la cámara. Permite el acceso y usa HTTPS.";}
}
window.API_ASISTENCIA=API;window.startQRScanner=startQRScanner;window.registrarCodigoQR=registrarCodigoQR;
