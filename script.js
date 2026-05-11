// ==================== FIREBASE CONFIG ====================
const firebaseConfig = {
  apiKey: "AIzaSyBJuex-BRYwvOJzNb2DIOtwxn_BOGopEHc",
  authDomain: "gestor-pacientes-3bced.firebaseapp.com",
  databaseURL: "https://gestor-pacientes-3bced-default-rtdb.firebaseio.com",
  projectId: "gestor-pacientes-3bced",
  storageBucket: "gestor-pacientes-3bced.firebasestorage.app",
  messagingSenderId: "357176116299",
  appId: "1:357176116299:web:5b0e3d2c611005b8fdb9ce"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

let currentUser = null;
let isAdmin = false;
const ADMIN_EMAIL = "danilonava2@gmail.com";
let currentReportRows = [];
let generalChart, previsionChart, userChart, userPrevisionChart;

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('section-registrar').classList.add('active');
  setupNavigation();
});

function setupNavigation() {
  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      const section = document.getElementById(`section-${item.dataset.section}`);
      if (section) section.classList.add('active');
      
      if (item.dataset.section === "pagos" && isAdmin) {
        document.getElementById('adminManagementSection').style.display = 'block';
      }
    });
  });
}

// ==================== FORMATEAR RUT ====================
function formatearRut(input) {
  let rut = input.value.replace(/[^0-9kK]/g, '').toUpperCase();
  if (rut.length > 9) rut = rut.substring(0,9);
  if (rut.length > 1) {
    let cuerpo = rut.slice(0,-1);
    let dv = rut.slice(-1);
    cuerpo = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    input.value = cuerpo + "-" + dv;
  } else input.value = rut;
}

document.getElementById('rut').addEventListener('input', () => formatearRut(document.getElementById('rut')));
document.getElementById('busquedaRut').addEventListener('input', () => formatearRut(document.getElementById('busquedaRut')));

// Monto automático
document.getElementById('prevision').addEventListener('change', function() {
  const monto = document.getElementById('monto');
  if (this.value === "FONASA") monto.value = 27310;
  else if (this.value === "PARTICULAR") monto.value = 40000;
  else if (this.value === "EXONERADO") monto.value = 0;
});

document.getElementById('fecha').valueAsDate = new Date();

// ==================== AUTH ====================
function login() {
  const email = document.getElementById('emailInput').value.trim();
  const password = document.getElementById('passwordInput').value;
  if (!email || !password) return alert("Completa todos los campos");

  auth.signInWithEmailAndPassword(email, password)
    .then(userCredential => {
      currentUser = userCredential.user;
      isAdmin = (currentUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
      if (isAdmin) document.getElementById('menu-dashboard').style.display = 'flex';
      document.getElementById('authModal').style.display = 'none';
      document.getElementById('mainApp').style.display = 'flex';
      if (isAdmin) cargarDashboard();
    })
    .catch(err => alert("Error: " + err.message));
}

function register() {
  const email = document.getElementById('emailInput').value.trim();
  const password = document.getElementById('passwordInput').value;

  if (!email || password.length < 6) {
    return alert("El correo es obligatorio y la contraseña debe tener al menos 6 caracteres");
  }

  // Protección con clave de administrador
  const clave = prompt("🔑 Ingresa la clave de administrador para crear una nueva cuenta:");
  if (clave !== "Adm123") {
    return alert("❌ Clave de administrador incorrecta. Solo el administrador puede crear cuentas.");
  }

  auth.createUserWithEmailAndPassword(email, password)
    .then(() => {
      alert("✅ Cuenta creada correctamente");
      login();
    })
    .catch(err => alert("Error al crear cuenta: " + err.message));
}

function recuperarContrasena() {
  const email = document.getElementById('emailInput').value.trim();
  if (!email) return alert("Ingresa tu correo");
  auth.sendPasswordResetEmail(email).then(() => alert("✅ Enlace enviado")).catch(err => alert("Error: " + err.message));
}

function logout() {
  if (confirm("¿Cerrar sesión?")) auth.signOut().then(() => location.reload());
}

// ==================== REGISTRAR PACIENTE ====================
document.getElementById('formPaciente').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!currentUser) return alert("Debes iniciar sesión primero");

  const data = {
    fecha: document.getElementById('fecha').value,
    nombre: document.getElementById('nombre').value.trim(),
    rut: document.getElementById('rut').value,
    prevision: document.getElementById('prevision').value,
    monto: parseInt(document.getElementById('monto').value) || 0,
    timestamp: Date.now(),
    userId: currentUser.uid,
    userEmail: currentUser.email
  };

  db.ref('pacientes').push(data)
    .then(() => {
      document.getElementById('successModal').style.display = 'flex';
      e.target.reset();
      document.getElementById('fecha').valueAsDate = new Date();
    })
    .catch(() => alert("Error al guardar"));
});

function cerrarModal() {
  document.getElementById('successModal').style.display = 'none';
}

// ==================== BÚSQUEDA AVANZADA ====================
async function buscarPacientes() {
  const fechaInicio = document.getElementById('busquedaFechaInicio').value;
  const fechaFin = document.getElementById('busquedaFechaFin').value;
  const nombre = document.getElementById('busquedaNombre').value.trim().toLowerCase();
  const rut = document.getElementById('busquedaRut').value.trim().toLowerCase();
  const prevision = document.getElementById('busquedaPrevision').value;
  const usuario = document.getElementById('busquedaUsuario').value.trim().toLowerCase();

  const div = document.getElementById('resultados');
  div.innerHTML = "<p>Buscando...</p>";

  const snapshot = await db.ref('pacientes').once('value');
  let html = `<table class="tabla-resultados"><tr><th>Fecha</th><th>Nombre</th><th>RUT</th><th>Previsión</th><th>Monto</th><th>Usuario</th>${isAdmin ? '<th>Acciones</th>' : ''}</tr>`;
  let count = 0;

  const start = fechaInicio ? new Date(fechaInicio) : null;
  const end = fechaFin ? new Date(fechaFin) : null;
  if (end) end.setHours(23,59,59);

  snapshot.forEach(child => {
    const p = child.val();
    if (!isAdmin && p.userId !== currentUser.uid) return;

    const fecha = new Date(p.fecha);
    const pasaFecha = !start || !end || (fecha >= start && fecha <= end);
    const pasaNombre = !nombre || p.nombre.toLowerCase().includes(nombre);
    const pasaRut = !rut || (p.rut && p.rut.toLowerCase().includes(rut));
    const pasaPrevision = !prevision || p.prevision === prevision;
    const pasaUsuario = !usuario || (p.userEmail && p.userEmail.toLowerCase().includes(usuario));

    if (pasaFecha && pasaNombre && pasaRut && pasaPrevision && pasaUsuario) {
      count++;
      html += `<tr>
        <td>${p.fecha}</td>
        <td>${p.nombre}</td>
        <td>${p.rut}</td>
        <td>${p.prevision}</td>
        <td>$${Number(p.monto).toLocaleString('es-CL')}</td>
        <td>${p.userEmail || 'N/A'}</td>`;
      if (isAdmin) {
        html += `<td>
          <button onclick="editarRegistro('${child.key}')" style="background:#f39c12;color:white;border:none;padding:6px 10px;margin-right:5px;border-radius:5px;">✏️</button>
          <button onclick="eliminarRegistro('${p.rut}','${child.key}')" style="background:#e74c3c;color:white;border:none;padding:6px 10px;border-radius:5px;">🗑️</button>
        </td>`;
      }
      html += `</tr>`;
    }
  });

  html += `</table>`;
  div.innerHTML = count === 0 ? "<p>No se encontraron registros.</p>" : html;
}

function limpiarFiltrosBusqueda() {
  document.getElementById('busquedaFechaInicio').value = '';
  document.getElementById('busquedaFechaFin').value = '';
  document.getElementById('busquedaNombre').value = '';
  document.getElementById('busquedaRut').value = '';
  document.getElementById('busquedaPrevision').value = '';
  document.getElementById('busquedaUsuario').value = '';
  buscarPacientes();
}

// ==================== EDICIÓN Y ELIMINACIÓN INDIVIDUAL ====================
async function editarRegistro(key) {
  const snap = await db.ref('pacientes/' + key).once('value');
  const p = snap.val();

  document.getElementById('editKey').value = key;
  document.getElementById('editFecha').value = p.fecha;
  document.getElementById('editNombre').value = p.nombre;
  document.getElementById('editRut').value = p.rut;
  document.getElementById('editPrevision').value = p.prevision;
  document.getElementById('editMonto').value = p.monto;

  const previsionSelect = document.getElementById('editPrevision');
  const montoInput = document.getElementById('editMonto');

  previsionSelect.onchange = () => {
    if (previsionSelect.value === "FONASA") montoInput.value = 27310;
    else if (previsionSelect.value === "PARTICULAR") montoInput.value = 40000;
    else if (previsionSelect.value === "EXONERADO") montoInput.value = 0;
  };

  document.getElementById('editModal').style.display = 'flex';
}

function guardarEdicion() {
  const key = document.getElementById('editKey').value;
  db.ref('pacientes/' + key).update({
    fecha: document.getElementById('editFecha').value,
    nombre: document.getElementById('editNombre').value.trim(),
    rut: document.getElementById('editRut').value,
    prevision: document.getElementById('editPrevision').value,
    monto: parseInt(document.getElementById('editMonto').value) || 0
  }).then(() => {
    alert("✅ Registro actualizado");
    cerrarEditModal();
    buscarPacientes();
  });
}

function cerrarEditModal() {
  document.getElementById('editModal').style.display = 'none';
}

async function eliminarRegistro(rut, key) {
  if (!confirm(`¿Eliminar registro del RUT ${rut}?`)) return;
  await db.ref('pacientes/' + key).remove();
  alert("Registro eliminado");
  buscarPacientes();
}

// ==================== DASHBOARD ====================
async function cargarDashboard() {
  if (!isAdmin) return;

  const inicio = document.getElementById('dashFechaInicio').value;
  const fin = document.getElementById('dashFechaFin').value;
  const usuarioFiltro = document.getElementById('dashUsuario').value.trim().toLowerCase();

  const snapshot = await db.ref('pacientes').once('value');
  let allData = [], userData = [];

  const start = inicio ? new Date(inicio) : null;
  const end = fin ? new Date(fin) : null;
  if (end) end.setHours(23,59,59);

  snapshot.forEach(child => {
    const p = child.val();
    const fecha = new Date(p.fecha);
    if (start && end && (fecha < start || fecha > end)) return;

    allData.push(p);
    if (!usuarioFiltro || (p.userEmail && p.userEmail.toLowerCase().includes(usuarioFiltro))) {
      userData.push(p);
    }
  });

  renderGeneralCharts(allData);
  renderUserCharts(userData);
}

function renderGeneralCharts(data) {
  const byMonth = {};
  data.forEach(p => {
    const mes = p.fecha.substring(0,7);
    if (!byMonth[mes]) byMonth[mes] = {pacientes: 0, monto: 0};
    byMonth[mes].pacientes++;
    byMonth[mes].monto += Number(p.monto) || 0;
  });

  const meses = Object.keys(byMonth).sort();
  const pacientesData = meses.map(m => byMonth[m].pacientes);
  const montoData = meses.map(m => byMonth[m].monto);

  if (generalChart) generalChart.destroy();
  generalChart = new Chart(document.getElementById('generalChart'), {
    type: 'bar',
    data: {
      labels: meses,
      datasets: [
        { label: 'Número de Pacientes', data: pacientesData, backgroundColor: '#3b82f6', yAxisID: 'y' },
        { label: 'Monto Total ($)', data: montoData, backgroundColor: '#10b981', yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: { type: 'linear', position: 'left', title: { display: true, text: 'Pacientes' }},
        y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Monto ($)' }}
      }
    }
  });

  const byPrevision = {FONASA:0, PARTICULAR:0, EXONERADO:0};
  data.forEach(p => byPrevision[p.prevision] = (byPrevision[p.prevision] || 0) + 1);

  if (previsionChart) previsionChart.destroy();
  previsionChart = new Chart(document.getElementById('previsionChart'), {
    type: 'pie',
    data: {
      labels: ['FONASA', 'PARTICULAR', 'EXONERADO'],
      datasets: [{ data: Object.values(byPrevision), backgroundColor: ['#3b82f6', '#8b5cf6', '#ec4899'] }]
    }
  });
}

function renderUserCharts(data) {
  const byMonth = {};
  data.forEach(p => {
    const mes = p.fecha.substring(0,7);
    if (!byMonth[mes]) byMonth[mes] = {pacientes: 0, monto: 0};
    byMonth[mes].pacientes++;
    byMonth[mes].monto += Number(p.monto) || 0;
  });

  const meses = Object.keys(byMonth).sort();
  const pacientesData = meses.map(m => byMonth[m].pacientes);
  const montoData = meses.map(m => byMonth[m].monto);

  if (userChart) userChart.destroy();
  userChart = new Chart(document.getElementById('userChart'), {
    type: 'bar',
    data: {
      labels: meses,
      datasets: [
        { label: 'Pacientes', data: pacientesData, backgroundColor: '#3b82f6', yAxisID: 'y' },
        { label: 'Monto ($)', data: montoData, backgroundColor: '#10b981', yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: { type: 'linear', position: 'left' },
        y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }}
      }
    }
  });

  const byPrevision = {FONASA:0, PARTICULAR:0, EXONERADO:0};
  data.forEach(p => byPrevision[p.prevision] = (byPrevision[p.prevision] || 0) + 1);

  if (userPrevisionChart) userPrevisionChart.destroy();
  userPrevisionChart = new Chart(document.getElementById('userPrevisionChart'), {
    type: 'doughnut',
    data: {
      labels: ['FONASA', 'PARTICULAR', 'EXONERADO'],
      datasets: [{ data: Object.values(byPrevision), backgroundColor: ['#3b82f6', '#8b5cf6', '#ec4899'] }]
    }
  });
}

// ==================== REPORTES ====================
async function generarReporte() {
  if (!currentUser) return alert("Inicia sesión primero");

  const inicio = document.getElementById('fechaInicio').value;
  const fin = document.getElementById('fechaFin').value;
  const nombre = document.getElementById('reporteNombre').value.trim().toLowerCase();
  const rut = document.getElementById('reporteRut').value.trim().toLowerCase();
  const previsionFiltro = document.getElementById('filtroPrevision').value;
  const usuario = document.getElementById('reporteUsuario').value.trim().toLowerCase();

  const container = document.getElementById('reporteContainer');
  container.innerHTML = "<p><strong>Generando reporte...</strong></p>";

  const snapshot = await db.ref('pacientes').once('value');
  let rows = [], totalPacientes = 0, totalBruto = 0;

  const start = inicio ? new Date(inicio) : null;
  const end = fin ? new Date(fin) : null;
  if (end) end.setHours(23,59,59);

  snapshot.forEach(child => {
    const p = child.val();
    if (!isAdmin && p.userId !== currentUser.uid) return;

    const fecha = new Date(p.fecha);
    const pasaFecha = !start || !end || (fecha >= start && fecha <= end);
    const pasaNombre = !nombre || p.nombre.toLowerCase().includes(nombre);
    const pasaRut = !rut || (p.rut && p.rut.toLowerCase().includes(rut));
    const pasaPrevision = !previsionFiltro || p.prevision === previsionFiltro;
    const pasaUsuario = !usuario || (p.userEmail && p.userEmail.toLowerCase().includes(usuario));

    if (pasaFecha && pasaNombre && pasaRut && pasaPrevision && pasaUsuario) {
      totalPacientes++;
      totalBruto += Number(p.monto) || 0;
      rows.push(p);
    }
  });

  currentReportRows = rows;

  if (totalPacientes === 0) {
    container.innerHTML = "<p>No se encontraron registros con los filtros aplicados.</p>";
    return;
  }

  const descuento20 = Math.round(totalBruto * 0.20);
  const subtotal = totalBruto - descuento20;
  const descuento1525 = Math.round(subtotal * 0.1525);
  const resultadoFinal = subtotal - descuento1525;

  let html = `<h3>Reporte`;
  if (inicio && fin) html += ` del ${inicio} al ${fin}`;
  else if (inicio) html += ` desde ${inicio}`;
  else if (fin) html += ` hasta ${fin}`;
  html += `</h3>`;

  if (previsionFiltro) html += `<p><strong>Previsión:</strong> ${previsionFiltro}</p>`;
  html += `<p><strong>Total Pacientes:</strong> ${totalPacientes}</p>`;

  html += `<table class="tabla-resultados"><tr><th>Fecha</th><th>Nombre</th><th>RUT</th><th>Previsión</th><th>Monto</th><th>Usuario</th></tr>`;
  rows.forEach(p => {
    html += `<tr><td>${p.fecha}</td><td>${p.nombre}</td><td>${p.rut}</td><td>${p.prevision}</td><td>$${Number(p.monto).toLocaleString('es-CL')}</td><td>${p.userEmail || 'N/A'}</td></tr>`;
  });
  html += `</table>`;

  html += `
    <div style="margin:25px 0; padding:25px; background:#f0fdf4; border-radius:12px; font-size:19px;">
      <p><strong>Total Bruto:</strong> $${totalBruto.toLocaleString('es-CL')}</p>
      <p><strong>Descuento 20%:</strong> <span style="color:#e74c3c;">-$${descuento20.toLocaleString('es-CL')}</span></p>
      <p><strong>Subtotal:</strong> $${subtotal.toLocaleString('es-CL')}</p>
      <p><strong>Descuento 15.25%:</strong> <span style="color:#e74c3c;">-$${descuento1525.toLocaleString('es-CL')}</span></p>
      <p style="font-size:28px; color:#00695c; margin-top:15px;"><strong>Resultado Final:</strong> $${resultadoFinal.toLocaleString('es-CL')}</p>
    </div>
    <button onclick="imprimirFactura('${inicio || ''}','${fin || ''}')" class="btn-primary">🖨️ Imprimir Factura Profesional</button>`;

  container.innerHTML = html;
}

function imprimirFactura(inicio, fin) {
  const win = window.open('', '_blank');
  let tablaHTML = '';
  let totalBrutoPrint = 0;

  currentReportRows.forEach(p => {
    totalBrutoPrint += Number(p.monto) || 0;
    tablaHTML += `<tr><td>${p.fecha}</td><td>${p.nombre}</td><td>${p.rut}</td><td>${p.prevision}</td><td>$${Number(p.monto).toLocaleString('es-CL')}</td></tr>`;
  });

  const descuento20 = Math.round(totalBrutoPrint * 0.20);
  const subtotal = totalBrutoPrint - descuento20;
  const descuento1525 = Math.round(subtotal * 0.1525);
  const resultadoFinal = subtotal - descuento1525;

  win.document.write(`
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"><title>Factura Profesional</title>
    <style>
      body{font-family:Arial,sans-serif;margin:30px;line-height:1.5;}
      .header{text-align:center;margin-bottom:25px;border-bottom:4px solid #00695c;padding-bottom:20px;}
      .logo-img { max-width: 220px; height: auto; margin-bottom: 10px; }
      table{width:100%;border-collapse:collapse;margin:20px 0;}
      th,td{border:1px solid #333;padding:8px;text-align:left;font-size:14px;}
      th{background:#00695c;color:white;}
      .totals{font-size:18px;margin:25px 0;}
      .final{font-size:24px;color:#00695c;font-weight:bold;}
    </style>
    </head><body>
      <div class="header">
        <img src="logo-clinicaflow.png" alt="ClinicaFlow" class="logo-img">
        <p style="margin:0; color:#555;">Sistema de Gestión de Pacientes</p>
        <p><strong>Período:</strong> ${inicio || '---'} al ${fin || '---'}</p>
      </div>
      <p><strong>Usuario:</strong> ${currentUser.email}</p>
      <table><tr><th>Fecha</th><th>Nombre</th><th>RUT</th><th>Previsión</th><th>Monto</th></tr>${tablaHTML}</table>
      <div class="totals">
        <p><strong>Total Bruto:</strong> $${totalBrutoPrint.toLocaleString('es-CL')}</p>
        <p><strong>Descuento 20%:</strong> -$${descuento20.toLocaleString('es-CL')}</p>
        <p><strong>Subtotal:</strong> $${subtotal.toLocaleString('es-CL')}</p>
        <p><strong>Descuento 15.25%:</strong> -$${descuento1525.toLocaleString('es-CL')}</p>
        <p class="final">Resultado Final: $${resultadoFinal.toLocaleString('es-CL')}</p>
      </div>
    </body></html>
  `);
  win.document.close();
  setTimeout(() => win.print(), 600);
}

function descargarExcel() {
  if (!currentUser) return alert("Inicia sesión primero");
  db.ref('pacientes').once('value')
    .then(snapshot => {
      const data = [["Fecha","Nombre","RUT","Previsión","Monto","Usuario"]];
      snapshot.forEach(child => {
        const p = child.val();
        if (isAdmin || p.userId === currentUser.uid) {
          data.push([p.fecha, p.nombre, p.rut, p.prevision, Number(p.monto), p.userEmail || ""]);
        }
      });
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "Pacientes");
      XLSX.writeFile(wb, `Pacientes_${new Date().toISOString().slice(0,10)}.xlsx`);
      alert("✅ Excel descargado correctamente");
    });
}

// ==================== ELIMINACIÓN MASIVA ====================
function mostrarInstruccionAuth(email) {
  const consoleUrl = "https://console.firebase.google.com/project/gestor-pacientes-3bced/authentication/users";
  alert(`✅ Se eliminaron todos los registros del usuario: ${email}\n\n` +
        `⚠️ Para eliminar también su cuenta de acceso (Auth), hazlo manualmente:\n\n` +
        `1. Abre: ${consoleUrl}\n` +
        `2. Busca el correo: ${email}\n` +
        `3. Haz clic en los tres puntos → Eliminar usuario`);
}

function eliminarRegistrosPorUsuario() {
  if (!isAdmin) return alert("Solo disponible para administrador");

  const emailInput = document.getElementById('deleteRecordsEmail');
  const email = emailInput.value.trim().toLowerCase();
  if (!email) return alert("Por favor ingresa el correo del usuario");

  const clave = prompt("🔑 Ingresa la clave de confirmación de administrador:");
  if (clave !== "Adm123") return alert("❌ Clave incorrecta. Operación cancelada.");

  if (!confirm(`¿Estás seguro de eliminar TODOS los registros del usuario?\n\n${email}\n\nEsta acción es IRREVERSIBLE.`)) return;

  db.ref('pacientes').once('value').then(snapshot => {
    let count = 0;
    const promises = [];
    snapshot.forEach(child => {
      const p = child.val();
      if (p.userEmail && p.userEmail.toLowerCase() === email) {
        promises.push(db.ref('pacientes/' + child.key).remove());
        count++;
      }
    });

    Promise.all(promises).then(() => {
      alert(`✅ Se eliminaron ${count} registros del usuario ${email}`);
      emailInput.value = '';
      mostrarInstruccionAuth(email);
      cargarDashboard();
      generarReporte();
      buscarPacientes();
    }).catch(err => alert("Error: " + err.message));
  });
}
