// Base de datos interna: un único archivo SQLite en /data/agencia.db
// Usa el módulo SQLite incorporado en Node (>= 22.13): no requiere compilar nada.
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'agencia.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario       TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    creado_en     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS servicios (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre        TEXT NOT NULL,
    descripcion   TEXT NOT NULL DEFAULT '',
    categoria     TEXT NOT NULL DEFAULT '',
    precio        REAL NOT NULL DEFAULT 0,
    moneda        TEXT NOT NULL DEFAULT 'ARS',
    duracion      TEXT NOT NULL DEFAULT '',
    imagen_url    TEXT NOT NULL DEFAULT '',
    activo        INTEGER NOT NULL DEFAULT 1,
    orden         INTEGER NOT NULL DEFAULT 0,
    creado_en     TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    actualizado_en TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS mensajes (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre        TEXT NOT NULL,
    email         TEXT NOT NULL,
    telefono      TEXT NOT NULL DEFAULT '',
    servicio_id   INTEGER REFERENCES servicios(id) ON DELETE SET NULL,
    asunto        TEXT NOT NULL DEFAULT '',
    mensaje       TEXT NOT NULL,
    leido         INTEGER NOT NULL DEFAULT 0,
    estado        TEXT NOT NULL DEFAULT 'nuevo',   -- nuevo | en_proceso | respondido | archivado
    notas         TEXT NOT NULL DEFAULT '',
    respuesta     TEXT NOT NULL DEFAULT '',
    respondido_en TEXT,
    ip            TEXT NOT NULL DEFAULT '',
    creado_en     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE INDEX IF NOT EXISTS idx_mensajes_creado ON mensajes(creado_en DESC);
  CREATE INDEX IF NOT EXISTS idx_servicios_orden ON servicios(orden, nombre);
`);

// Usuario admin inicial (configurable por variables de entorno)
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';
const existe = db.prepare('SELECT 1 FROM usuarios WHERE usuario = ?').get(ADMIN_USER);
if (!existe) {
  db.prepare('INSERT INTO usuarios (usuario, password_hash) VALUES (?, ?)')
    .run(ADMIN_USER, bcrypt.hashSync(ADMIN_PASS, 10));
  console.log(`[db] usuario admin creado: ${ADMIN_USER} / ${ADMIN_PASS}  (cambiá la contraseña desde el panel)`);
}

module.exports = db;
