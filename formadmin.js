const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const fmt = (n, m) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: m || 'ARS', maximumFractionDigits: 0 }).format(n);
const ESTADOS = { nuevo: 'Nuevo', en_proceso: 'En proceso', respondido: 'Respondido', archivado: 'Archivado' };

async function api(url, opts = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  if (res.status === 401 && !url.includes('/auth/')) { mostrarLogin(); throw new Error('Sesión expirada'); }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Error');
  return json;
}
const alerta = (id, msg, tipo = 'err') => { $('#' + id).innerHTML = msg ? `<div class="alert ${tipo}">${esc(msg)}</div>` : ''; };
const abrir = (id) => $('#' + id).classList.add('open');
const cerrar = (id) => $('#' + id).classList.remove('open');

// ---------- auth ----------
function mostrarLogin() { $('#view-app').classList.add('hidden'); $('#view-login').classList.remove('hidden'); }
async function init() {
  try { const me = await api('/api/auth/me'); iniciarApp(me.usuario); } catch { mostrarLogin(); }
}
$('#form-login').addEventListener('submit', async (e) => {
  e.preventDefault(); alerta('login-alert', '');
  try {
    const r = await api('/api/auth/login', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
    e.target.reset(); iniciarApp(r.usuario);
  } catch (err) { alerta('login-alert', err.message); }
});
$('#btn-logout').addEventListener('click', async (e) => { e.preventDefault(); await api('/api/auth/logout', { method: 'POST' }); mostrarLogin(); });
$('#form-pass').addEventListener('submit', async (e) => {
  e.preventDefault(); alerta('pass-alert', '');
  try { await api('/api/auth/password', { method: 'PUT', body: Object.fromEntries(new FormData(e.target)) }); e.target.reset(); alerta('pass-alert', 'Contraseña actualizada', 'ok'); }
  catch (err) { alerta('pass-alert', err.message); }
});

function iniciarApp(usuario) {
  $('#view-login').classList.add('hidden'); $('#view-app').classList.remove('hidden');
  $('#hola').textContent = `Hola, ${usuario}`;
  navegar();
}

// ---------- navegación ----------
window.addEventListener('hashchange', navegar);
function navegar() {
  const v = (location.hash || '#dashboard').slice(1);
  const vista = ['dashboard', 'servicios', 'mensajes', 'cuenta'].includes(v) ? v : 'dashboard';
  document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden'));
  $('#sec-' + vista).classList.remove('hidden');
  document.querySelectorAll('aside a.nav').forEach(a => a.classList.toggle('active', a.dataset.view === vista));
  ({ dashboard: cargarDashboard, servicios: cargarServicios, mensajes: cargarMensajes, cuenta: () => {} })[vista]();
  actualizarBadge();
}
async function actualizarBadge() {
  try { const r = await api('/api/admin/mensajes/resumen'); const b = $('#badge-noleidos'); b.textContent = r.no_leidos; b.classList.toggle('hidden', !r.no_leidos); } catch {}
}

// ---------- dashboard ----------
async function cargarDashboard() {
  const r = await api('/api/admin/mensajes/resumen');
  $('#stats').innerHTML = [
    [r.no_leidos, 'Mensajes sin leer'], [r.nuevos, 'Mensajes nuevos'], [r.total, 'Mensajes totales'],
    [r.servicios_activos + ' / ' + r.servicios, 'Servicios publicados'],
  ].map(([n, l]) => `<div class="stat"><div class="n">${n}</div><div class="l">${l}</div></div>`).join('');
  const msgs = (await api('/api/admin/mensajes')).slice(0, 5);
  $('#dash-mensajes').innerHTML = tablaMensajes(msgs);
}

// ---------- servicios ----------
let servicios = [];
async function cargarServicios() {
  servicios = await api('/api/admin/servicios');
  const c = $('#tabla-servicios');
  if (!servicios.length) { c.innerHTML = '<div class="panel empty">No hay servicios. Creá el primero con "+ Nuevo servicio".</div>'; return; }
  c.innerHTML = `<table><thead><tr><th>Orden</th><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Duración</th><th>Estado</th><th></th></tr></thead><tbody>
    ${servicios.map(s => `<tr>
      <td>${s.orden}</td>
      <td><b>${esc(s.nombre)}</b><div style="font-size:12px;color:var(--muted);max-width:340px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s.descripcion)}</div></td>
      <td>${esc(s.categoria)}</td>
      <td>${s.precio > 0 ? fmt(s.precio, s.moneda) : '—'}</td>
      <td>${esc(s.duracion)}</td>
      <td><span class="pill ${s.activo ? 'on' : 'off'}">${s.activo ? 'Publicado' : 'Oculto'}</span></td>
      <td class="actions">
        <button class="btn secondary sm" onclick="abrirServicio(${s.id})">Editar</button>
        <button class="btn secondary sm" onclick="toggleServicio(${s.id})">${s.activo ? 'Ocultar' : 'Publicar'}</button>
        <button class="btn danger sm" onclick="borrarServicio(${s.id})">Borrar</button>
      </td></tr>`).join('')}
  </tbody></table>`;
}
function abrirServicio(id) {
  const f = $('#form-servicio'); f.reset(); alerta('servicio-alert', '');
  const s = id ? servicios.find(x => x.id === id) : null;
  $('#modal-servicio-titulo').textContent = s ? 'Editar servicio' : 'Nuevo servicio';
  f.id.value = s ? s.id : '';
  if (s) { ['nombre', 'categoria', 'descripcion', 'precio', 'moneda', 'duracion', 'orden', 'imagen_url'].forEach(k => f[k].value = s[k]); f.activo.checked = !!s.activo; }
  abrir('modal-servicio'); f.nombre.focus();
}
$('#form-servicio').addEventListener('submit', async (e) => {
  e.preventDefault(); const f = e.target;
  const body = Object.fromEntries(new FormData(f)); body.activo = f.activo.checked;
  try {
    if (f.id.value) await api('/api/admin/servicios/' + f.id.value, { method: 'PUT', body });
    else await api('/api/admin/servicios', { method: 'POST', body });
    cerrar('modal-servicio'); cargarServicios();
  } catch (err) { alerta('servicio-alert', err.message); }
});
async function toggleServicio(id) { await api(`/api/admin/servicios/${id}/activo`, { method: 'PATCH' }); cargarServicios(); }
async function borrarServicio(id) {
  const s = servicios.find(x => x.id === id);
  if (!window.confirm(`¿Eliminar "${s.nombre}"? Esta acción no se puede deshacer.`)) return;
  await api('/api/admin/servicios/' + id, { method: 'DELETE' }); cargarServicios();
}

// ---------- mensajes ----------
let mensajes = [];
function tablaMensajes(lista) {
  if (!lista.length) return '<div class="panel empty">No hay mensajes.</div>';
  return `<table><thead><tr><th>Fecha</th><th>De</th><th>Asunto</th><th>Servicio</th><th>Estado</th></tr></thead><tbody>
    ${lista.map(m => `<tr class="clickable ${m.leido ? '' : 'unread'}" onclick="abrirMensaje(${m.id})">
      <td style="white-space:nowrap">${esc(m.creado_en.slice(0, 16))}</td>
      <td>${esc(m.nombre)}<div style="font-size:12px;color:var(--muted);font-weight:400">${esc(m.email)}</div></td>
      <td>${esc(m.asunto) || '<span style="color:var(--muted)">(sin asunto)</span>'}</td>
      <td>${esc(m.servicio_nombre || '—')}</td>
      <td><span class="pill ${m.estado}">${ESTADOS[m.estado]}</span></td>
    </tr>`).join('')}
  </tbody></table>`;
}
async function cargarMensajes() {
  const p = new URLSearchParams();
  if ($('#f-q').value) p.set('q', $('#f-q').value);
  if ($('#f-estado').value) p.set('estado', $('#f-estado').value);
  if ($('#f-leido').value) p.set('leido', $('#f-leido').value);
  mensajes = await api('/api/admin/mensajes?' + p);
  $('#tabla-mensajes').innerHTML = tablaMensajes(mensajes);
}
$('#f-q').addEventListener('keydown', (e) => e.key === 'Enter' && cargarMensajes());
async function abrirMensaje(id) {
  const m = await api('/api/admin/mensajes/' + id); // marca como leído
  alerta('mensaje-alert', '');
  $('#mensaje-detalle').innerHTML = `
    <div class="kv">
      <b>De</b><span>${esc(m.nombre)} · <a href="mailto:${esc(m.email)}">${esc(m.email)}</a>${m.telefono ? ' · ' + esc(m.telefono) : ''}</span>
      <b>Fecha</b><span>${esc(m.creado_en)}</span>
      <b>Servicio</b><span>${esc(m.servicio_nombre || '—')}</span>
      <b>Asunto</b><span>${esc(m.asunto) || '—'}</span>
      ${m.respondido_en ? `<b>Respondido</b><span>${esc(m.respondido_en)}</span>` : ''}
    </div>
    <div class="msg-box">${esc(m.mensaje)}</div>
    <p style="margin:8px 0 14px"><a class="btn secondary sm" href="mailto:${esc(m.email)}?subject=${encodeURIComponent('Re: ' + (m.asunto || 'Tu consulta'))}">Responder por email</a></p>`;
  const f = $('#form-mensaje'); f.id.value = m.id; f.estado.value = m.estado; f.leido.checked = !!m.leido; f.respuesta.value = m.respuesta; f.notas.value = m.notas;
  abrir('modal-mensaje');
  refrescarListas();
}
$('#form-mensaje').addEventListener('submit', async (e) => {
  e.preventDefault(); const f = e.target;
  try {
    await api('/api/admin/mensajes/' + f.id.value, { method: 'PATCH', body: { estado: f.estado.value, leido: f.leido.checked, respuesta: f.respuesta.value, notas: f.notas.value } });
    cerrar('modal-mensaje'); refrescarListas();
  } catch (err) { alerta('mensaje-alert', err.message); }
});
$('#btn-borrar-mensaje').addEventListener('click', async () => {
  const id = $('#form-mensaje').id.value;
  if (!window.confirm('¿Eliminar este mensaje definitivamente?')) return;
  await api('/api/admin/mensajes/' + id, { method: 'DELETE' }); cerrar('modal-mensaje'); refrescarListas();
});
function refrescarListas() {
  actualizarBadge();
  if (!$('#sec-mensajes').classList.contains('hidden')) cargarMensajes();
  if (!$('#sec-dashboard').classList.contains('hidden')) cargarDashboard();
}

document.querySelectorAll('.modal-bg').forEach(m => m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('open'); }));
init();