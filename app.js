"use strict";

/*
 * Interfaz inicial.
 * No contiene contraseñas, claves ni datos personales.
 * La autenticación y el registro se habilitarán al completar la integración
 * segura con Google Apps Script.
 */
document.addEventListener("DOMContentLoaded", () => {
  const message = document.getElementById("scanMessage");
  const form = document.getElementById("loginForm");

  if (message) {
    message.textContent = "La conexión con el servidor aún no está configurada.";
  }

  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      message.textContent = "El acceso se habilitará después de configurar la autenticación del servidor.";
    });
  }

  console.info("Interfaz del Sistema de Asistencia QR cargada.");
});
