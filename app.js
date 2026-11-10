const $ = (id) => document.getElementById(id);
if (window.lucide) lucide.createIcons();

const loginView = $("loginView");
const appView = $("appView");
const toast = $("toast");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 3200);
}

// Prototipo visual: no valida credenciales ni crea una sesión real.
$("loginForm").addEventListener("submit", (event) => {
  event.preventDefault();
  showToast("Inicio de sesión aún no conectado. No se validaron credenciales.");
});

function openAppDemo() {
  loginView.classList.add("hidden");
  appView.classList.remove("hidden");
}
function openLogin() {
  appView.classList.add("hidden");
  loginView.classList.remove("hidden");
  $("password").value = "";
}
function goTo(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const target = $("page-" + page);
  if (target) target.classList.add("active");
  document.querySelectorAll(".nav-item").forEach(btn => btn.classList.toggle("active", btn.dataset.page === page));
  const active = document.querySelector(`.nav-item[data-page="${page}"]`);
  $("crumb").textContent = active ? active.textContent.trim() : "Dashboard";
  $("sidebar").classList.remove("open");
  if (window.lucide) lucide.createIcons();
}

document.querySelectorAll(".nav-item").forEach(btn => btn.addEventListener("click", () => goTo(btn.dataset.page)));
document.querySelectorAll("[data-goto]").forEach(btn => btn.addEventListener("click", () => goTo(btn.dataset.goto)));
$("logoutBtn").addEventListener("click", openLogin);
$("menuBtn").addEventListener("click", () => $("sidebar").classList.toggle("open"));
$("testScan").addEventListener("click", () => {
  showToast("Conexión pendiente: no se registró asistencia.");
  $("scanMessage").textContent = "Servidor no conectado. No se modificó Google Sheets.";
});

const now = new Date();
$("today").textContent = new Intl.DateTimeFormat("es-PE", { weekday:"short", day:"2-digit", month:"short" }).format(now);
$("dateLong").textContent = new Intl.DateTimeFormat("es-PE", { weekday:"long", day:"numeric", month:"long", year:"numeric" }).format(now);
