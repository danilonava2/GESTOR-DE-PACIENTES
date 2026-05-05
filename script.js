const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwk97z3Yqyrte6l5N5MQ5DlJg8fF8hFNps9EIaYPpvJNpQc0jZpokIJQTKcvhaYkgr3/exec";   // ← CAMBIA ESTO

// Formatear RUT
function formatearRut(input) {
  let rut = input.value.replace(/[^0-9kK]/g, '');
  if (rut.length > 9) rut = rut.substring(0, 9);
  if (rut.length > 1) {
    let cuerpo = rut.slice(0, -1);
    let dv = rut.slice(-1).toUpperCase();
    cuerpo = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    input.value = cuerpo + "-" + dv;
  } else {
    input.value = rut;
  }
}

document.getElementById('rut').addEventListener('input', () => formatearRut(document.getElementById('rut')));
document.getElementById('busqueda').addEventListener('input', () => formatearRut(document.getElementById('busqueda')));

// Monto automático
document.getElementById('prevision').addEventListener('change', function() {
  const monto = document.getElementById('monto');
  if (this.value === "FONASA") monto.value = 27310;
  else if (this.value === "PARTICULAR") monto.value = 40000;
  else if (this.value === "EXONERADO") monto.value = 0;
  else monto.value = "";
});

document.getElementById('fecha').valueAsDate = new Date();

// Navegación
document.querySelectorAll('.menu-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(`section-${item.dataset.section}`).classList.add('active');
  });
});

// Registrar
document.getElementById('formPaciente').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    fecha: document.getElementById('fecha').value,
    nombre: document.getElementById('nombre').value.trim(),
    rut: document.getElementById('rut').value,
    prevision: document.getElementById('prevision').value,
    monto: parseInt(document.getElementById('monto').value) || 0
  };

  try {
    await fetch(WEBAPP_URL, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json" }
    });
    document.getElementById('successModal').style.display = 'flex';
    document.getElementById('formPaciente').reset();
    document.getElementById('fecha').valueAsDate = new Date();
  } catch (err) {
    alert("Error al registrar");
  }
});

function cerrarModal() {
  document.getElementById('successModal').style.display = 'none';
}

// Buscar
async function buscarPacientes() {
  const rut = document.getElementById('busqueda').value.trim();
  const div = document.getElementById('resultados');
  if (!rut) return alert("Ingrese RUT");

  div.innerHTML = "<p>Buscando...</p>";

  try {
    const res = await fetch(`${WEBAPP_URL}?action=buscar&rut=${encodeURIComponent(rut)}`);
    const data = await res.json();

    if (data.length === 0) {
      div.innerHTML = "<p>No se encontraron registros.</p>";
      return;
    }

    let html = `<table class="tabla-resultados"><tr><th>Fecha</th><th>Nombre</th><th>RUT</th><th>Previsión</th><th>Monto</th></tr>`;
    data.forEach(p => {
      html += `<tr><td>${p.fecha}</td><td>${p.nombre}</td><td>${p.rut}</td><td>${p.prevision}</td><td>$${Number(p.monto).toLocaleString('es-CL')}</td></tr>`;
    });
    html += `</table>`;
    div.innerHTML = html;
  } catch (e) {
    div.innerHTML = "<p style='color:red'>Error al buscar. Verifica la URL del Apps Script.</p>";
  }
}

// Reporte
async function generarReporte() {
  const inicio = document.getElementById('fechaInicio').value;
  const fin = document.getElementById('fechaFin').value;
  const container = document.getElementById('reporteContainer');

  if (!inicio || !fin) return alert("Selecciona ambas fechas");

  container.innerHTML = "<p>Generando reporte...</p>";

  try {
    const res = await fetch(`${WEBAPP_URL}?action=reporte&inicio=${inicio}&fin=${fin}`);
    const data = await res.json();

    let html = `
      <h3>Reporte ${inicio} al ${fin}</h3>
      <table class="tabla-resultados">
        <tr><th>Descripción</th><th>Cantidad</th><th>Total</th></tr>
        <tr><td>FONASA</td><td>${data.fonasaCount}</td><td>$${data.totalFonasa.toLocaleString('es-CL')}</td></tr>
        <tr><td>PARTICULAR</td><td>${data.particularCount}</td><td>$${data.totalParticular.toLocaleString('es-CL')}</td></tr>
        <tr><td><strong>TOTAL BRUTO</strong></td><td></td><td><strong>$${data.totalBruto.toLocaleString('es-CL')}</strong></td></tr>
      </table>
      <div style="margin:20px 0;font-size:18px;">
        <p>Resultado Final: <strong>$${data.resultadoFinal.toLocaleString('es-CL')}</strong></p>
      </div>
      <button onclick="imprimirReporte('${inicio}','${fin}')" class="btn-primary">🖨️ Imprimir Reporte</button>`;
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = "<p>Error al generar reporte</p>";
  }
}

function imprimirReporte(inicio, fin) {
  window.open(`${WEBAPP_URL}?action=imprimir&inicio=${inicio}&fin=${fin}`, '_blank');
}