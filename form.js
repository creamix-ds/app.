document.getElementById('anio').textContent = new Date().getFullYear();
const fmt = (n, m) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: m || 'ARS', maximumFractionDigits: 0 }).format(n);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

async function cargarServicios() {
  const res = await fetch('/api/servicios');
  const servicios = await res.json();
  const cont = document.getElementById('lista-servicios');
  const sel = document.querySelector('select[name=servicio_id]');
  if (!servicios.length) { cont.innerHTML = '<div class="empty">Todavía no hay servicios publicados.</div>'; return; }
  cont.innerHTML = servicios.map(s => `
    <article class="card">
      ${s.imagen_url ? `<img src="${esc(s.imagen_url)}" alt="${esc(s.nombre)}" loading="lazy">` : ''}
      <div class="body">
        ${s.categoria ? `<div class="cat">${esc(s.categoria)}</div>` : ''}
        <h3>${esc(s.nombre)}</h3>
        <p>${esc(s.descripcion)}</p>
        <div class="meta">
          <span class="price">${s.precio > 0 ? fmt(s.precio, s.moneda) : 'A consultar'}</span>
          <span class="dur">${esc(s.duracion)}</span>
        </div>
        <a class="btn sm" href="#contacto" data-id="${s.id}" onclick="preseleccionar(${s.id})">Consultar</a>
      </div>
    </article>`).join('');
  servicios.forEach(s => sel.insertAdjacentHTML('beforeend', `<option value="${s.id}">${esc(s.nombre)}</option>`));
}
function preseleccionar(id) { document.querySelector('select[name=servicio_id]').value = id; }

document.getElementById('form-contacto').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target, btn = document.getElementById('btn-enviar'), alertBox = document.getElementById('contacto-alert');
  btn.disabled = true; alertBox.innerHTML = '';
  const data = Object.fromEntries(new FormData(form).entries());
  try {
    const res = await fetch('/api/contacto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Error al enviar');
    alertBox.innerHTML = '<div class="alert ok">¡Gracias! Recibimos tu mensaje y te contactaremos pronto.</div>';
    form.reset();
  } catch (err) {
    alertBox.innerHTML = `<div class="alert err">${esc(err.message)}</div>`;
  } finally { btn.disabled = false; }
});
cargarServicios();