/*
 * Interfaz de la I.E. 5074 Alcides Spelucín Vega.
 * El escaneo y el inicio de sesión permanecen deshabilitados intencionalmente
 * hasta implementar y probar autenticación segura entre GitHub Pages y Apps Script.
 * No agregar contraseñas, tokens ni datos de estudiantes a este archivo.
 */
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      window.alert("El acceso estará disponible después de configurar la autenticación segura del servidor.");
    });
  }

  const scanButton = document.getElementById("scan-button");
  if (scanButton) {
    scanButton.addEventListener("click", () => {
      window.alert("El escáner se habilitará después de probar la conexión segura con Google Apps Script.");
    });
  }
});
