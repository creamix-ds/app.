// Carga datos de ejemplo. Ejecutar: npm run seed
const db = require('./db');

const servicios = [
  ['Diseño de identidad visual', 'Logo, paleta, tipografías y manual de marca listo para usar en todos tus canales.', 'Diseño', 180000, 'ARS', '3 semanas', 1],
  ['Sitio web institucional', 'Sitio responsive de hasta 6 secciones, optimizado para SEO y velocidad.', 'Desarrollo', 350000, 'ARS', '4 semanas', 2],
  ['Gestión de redes sociales', 'Planificación, diseño y publicación de contenido mensual en Instagram y LinkedIn.', 'Marketing', 120000, 'ARS', 'Mensual', 3],
  ['Campañas de Google Ads', 'Configuración y optimización continua de campañas de búsqueda y display.', 'Marketing', 0, 'ARS', 'Mensual', 4],
];
const ins = db.prepare('INSERT INTO servicios (nombre, descripcion, categoria, precio, moneda, duracion, orden) VALUES (?,?,?,?,?,?,?)');
const insM = db.prepare('INSERT INTO mensajes (nombre, email, telefono, servicio_id, asunto, mensaje) VALUES (?,?,?,?,?,?)');

db.exec('BEGIN');
try {
  const ids = servicios.map((s) => Number(ins.run(...s).lastInsertRowid));
  insM.run('Laura Pérez', 'laura@ejemplo.com', '11 5555-1234', ids[1], 'Presupuesto web', 'Hola, quisiera un presupuesto para el sitio de mi estudio contable. ¿Incluye hosting?');
  insM.run('Martín Gómez', 'martin@ejemplo.com', '', ids[2], 'Redes para mi local', 'Tengo una cafetería y quiero empezar con Instagram. ¿Cómo trabajan?');
  db.exec('COMMIT');
} catch (e) { db.exec('ROLLBACK'); throw e; }

console.log(`Seed listo: ${servicios.length} servicios y 2 mensajes de ejemplo.`);
