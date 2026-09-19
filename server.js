const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'cambiar-este-secreto-en-produccion',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 },
}));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- helpers ----------
const requireAuth = (req, res, next) =>
  req.session.userId ? next() : res.status(401).json({ error: 'No autorizado' });

const toInt = (v, d = 0) => (Number.isFinite(+v) ? Math.trunc(+v) : d);
const clean = (v) => (v == null ? '' : String(v).trim());

function validarServicio(b) {
  const nombre = clean(b.nombre);
  if (!nombre) return { error: 'El nombre es obligatorio' };
  const precio = Number(b.precio);
  if (!Number.isFinite(precio) || precio < 0) return { error: 'Precio inválido' };
  return {
    data: {
      nombre,
      descripcion: clean(b.descripcion),
      categoria: clean(b.categoria),
      precio,
      moneda: clean(b.moneda) || 'ARS',
      duracion: clean(b.duracion),
      imagen_url: clean(b.imagen_url),
      activo: b.activo === false || b.activo === 0 || b.activo === '0' ? 0 : 1,
      orden: toInt(b.orden, 0),
    },
  };
}

// Rate limit muy simple para el formulario público (por IP, en memoria)
const hits = new Map();
function limitarContacto(req, res, next) {
  const ip = req.ip;
  const ahora = Date.now();
  const lista = (hits.get(ip) || []).filter((t) => ahora - t < 10 * 60 * 1000);
  if (lista.length >= 5) return res.status(429).json({ error: 'Demasiados envíos, probá más tarde.' });
  lista.push(ahora);
  hits.set(ip, lista);
  next();
}

// ---------- AUTH ----------
app.post('/api/auth/login', (req, res) => {
  const { usuario, password } = req.body || {};
  const u = db.prepare('SELECT * FROM usuarios WHERE usuario = ?').get(clean(usuario));
  if (!u || !bcrypt.compareSync(String(password || ''), u.password_hash)) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }
  req.session.userId = u.id;
  req.session.usuario = u.usuario;
  res.json({ ok: true, usuario: u.usuario });
});

app.post('/api/auth/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));

app.get('/api/auth/me', (req, res) =>
  req.session.userId ? res.json({ usuario: req.session.usuario }) : res.status(401).json({ error: 'No autorizado' })
);

app.put('/api/auth/password', requireAuth, (req, res) => {
  const { actual, nueva } = req.body || {};
  const u = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.session.userId);
  if (!bcrypt.compareSync(String(actual || ''), u.password_hash)) return res.status(400).json({ error: 'Contraseña actual incorrecta' });
  if (!nueva || String(nueva).length < 6) return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
  db.prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(String(nueva), 10), u.id);
  res.json({ ok: true });
});

// ---------- SERVICIOS (público: solo activos) ----------
app.get('/api/servicios', (req, res) => {
  const rows = db.prepare('SELECT id, nombre, descripcion, categoria, precio, moneda, duracion, imagen_url FROM servicios WHERE activo = 1 ORDER BY orden, nombre').all();
  res.json(rows);
});

// ---------- SERVICIOS (admin: CRUD completo) ----------
app.get('/api/admin/servicios', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM servicios ORDER BY orden, nombre').all());
});

app.get('/api/admin/servicios/:id', requireAuth, (req, res) => {
  const s = db.prepare('SELECT * FROM servicios WHERE id = ?').get(req.params.id);
  s ? res.json(s) : res.status(404).json({ error: 'No encontrado' });
});

app.post('/api/admin/servicios', requireAuth, (req, res) => {
  const v = validarServicio(req.body || {});
  if (v.error) return res.status(400).json({ error: v.error });
  const d = v.data;
  const r = db.prepare(`INSERT INTO servicios (nombre, descripcion, categoria, precio, moneda, duracion, imagen_url, activo, orden)
                        VALUES (@nombre, @descripcion, @categoria, @precio, @moneda, @duracion, @imagen_url, @activo, @orden)`).run(d);
  res.status(201).json(db.prepare('SELECT * FROM servicios WHERE id = ?').get(r.lastInsertRowid));
});

app.put('/api/admin/servicios/:id', requireAuth, (req, res) => {
  if (!db.prepare('SELECT 1 FROM servicios WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'No encontrado' });
  const v = validarServicio(req.body || {});
  if (v.error) return res.status(400).json({ error: v.error });
  db.prepare(`UPDATE servicios SET nombre=@nombre, descripcion=@descripcion, categoria=@categoria, precio=@precio, moneda=@moneda,
              duracion=@duracion, imagen_url=@imagen_url, activo=@activo, orden=@orden, actualizado_en=datetime('now','localtime')
              WHERE id=@id`).run({ ...v.data, id: req.params.id });
  res.json(db.prepare('SELECT * FROM servicios WHERE id = ?').get(req.params.id));
});

app.patch('/api/admin/servicios/:id/activo', requireAuth, (req, res) => {
  const r = db.prepare(`UPDATE servicios SET activo = CASE activo WHEN 1 THEN 0 ELSE 1 END, actualizado_en=datetime('now','localtime') WHERE id = ?`).run(req.params.id);
  if (!r.changes) return res.status(404).json({ error: 'No encontrado' });
  res.json(db.prepare('SELECT * FROM servicios WHERE id = ?').get(req.params.id));
});

app.delete('/api/admin/servicios/:id', requireAuth, (req, res) => {
  const r = db.prepare('DELETE FROM servicios WHERE id = ?').run(req.params.id);
  r.changes ? res.json({ ok: true }) : res.status(404).json({ error: 'No encontrado' });
});

// ---------- CONTACTO (público) ----------
app.post('/api/contacto', limitarContacto, (req, res) => {
  const b = req.body || {};
  if (clean(b.website)) return res.status(201).json({ ok: true }); // honeypot anti-bots
  const nombre = clean(b.nombre), email = clean(b.email), mensaje = clean(b.mensaje);
  if (!nombre || !email || !mensaje) return res.status(400).json({ error: 'Nombre, email y mensaje son obligatorios' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Email inválido' });
  let servicio_id = toInt(b.servicio_id, 0) || null;
  if (servicio_id && !db.prepare('SELECT 1 FROM servicios WHERE id = ?').get(servicio_id)) servicio_id = null;
  db.prepare(`INSERT INTO mensajes (nombre, email, telefono, servicio_id, asunto, mensaje, ip)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(nombre, email, clean(b.telefono), servicio_id, clean(b.asunto).slice(0, 200), mensaje.slice(0, 5000), req.ip || '');
  res.status(201).json({ ok: true });
});

// ---------- MENSAJES (admin) ----------
app.get('/api/admin/mensajes', requireAuth, (req, res) => {
  const { estado, leido, q } = req.query;
  const where = [], params = [];
  if (estado) { where.push('m.estado = ?'); params.push(estado); }
  if (leido === '0' || leido === '1') { where.push('m.leido = ?'); params.push(+leido); }
  if (q) { where.push('(m.nombre LIKE ? OR m.email LIKE ? OR m.asunto LIKE ? OR m.mensaje LIKE ?)'); params.push(...Array(4).fill(`%${q}%`)); }
  const sql = `SELECT m.*, s.nombre AS servicio_nombre FROM mensajes m LEFT JOIN servicios s ON s.id = m.servicio_id
               ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY m.creado_en DESC, m.id DESC`;
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/admin/mensajes/resumen', requireAuth, (req, res) => {
  res.json({
    total: db.prepare('SELECT COUNT(*) c FROM mensajes').get().c,
    no_leidos: db.prepare('SELECT COUNT(*) c FROM mensajes WHERE leido = 0').get().c,
    nuevos: db.prepare("SELECT COUNT(*) c FROM mensajes WHERE estado = 'nuevo'").get().c,
    servicios: db.prepare('SELECT COUNT(*) c FROM servicios').get().c,
    servicios_activos: db.prepare('SELECT COUNT(*) c FROM servicios WHERE activo = 1').get().c,
  });
});

app.get('/api/admin/mensajes/:id', requireAuth, (req, res) => {
  const m = db.prepare('SELECT m.*, s.nombre AS servicio_nombre FROM mensajes m LEFT JOIN servicios s ON s.id = m.servicio_id WHERE m.id = ?').get(req.params.id);
  if (!m) return res.status(404).json({ error: 'No encontrado' });
  if (!m.leido) { db.prepare('UPDATE mensajes SET leido = 1 WHERE id = ?').run(m.id); m.leido = 1; }
  res.json(m);
});

app.patch('/api/admin/mensajes/:id', requireAuth, (req, res) => {
  const m = db.prepare('SELECT * FROM mensajes WHERE id = ?').get(req.params.id);
  if (!m) return res.status(404).json({ error: 'No encontrado' });
  const b = req.body || {};
  const estados = ['nuevo', 'en_proceso', 'respondido', 'archivado'];
  const upd = {
    id: m.id,
    leido: b.leido == null ? m.leido : (b.leido ? 1 : 0),
    estado: estados.includes(b.estado) ? b.estado : m.estado,
    notas: b.notas == null ? m.notas : clean(b.notas),
    respuesta: b.respuesta == null ? m.respuesta : clean(b.respuesta),
  };
  const marcaRespuesta = b.respuesta != null && clean(b.respuesta) && !m.respuesta;
  if (marcaRespuesta && b.estado == null) upd.estado = 'respondido';
  db.prepare(`UPDATE mensajes SET leido=@leido, estado=@estado, notas=@notas, respuesta=@respuesta,
              respondido_en = CASE WHEN @respuesta <> '' AND respondido_en IS NULL THEN datetime('now','localtime') ELSE respondido_en END
              WHERE id=@id`).run(upd);
  res.json(db.prepare('SELECT m.*, s.nombre AS servicio_nombre FROM mensajes m LEFT JOIN servicios s ON s.id = m.servicio_id WHERE m.id = ?').get(m.id));
});

app.delete('/api/admin/mensajes/:id', requireAuth, (req, res) => {
  const r = db.prepare('DELETE FROM mensajes WHERE id = ?').run(req.params.id);
  r.changes ? res.json({ ok: true }) : res.status(404).json({ error: 'No encontrado' });
});

// ---------- páginas ----------
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno' });
});

app.listen(PORT, () => {
  console.log(`Sitio público: http://localhost:${PORT}`);
  console.log(`Panel admin:   http://localhost:${PORT}/admin`);
});
