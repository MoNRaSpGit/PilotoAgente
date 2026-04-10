import { pool } from '../../config/db.js';

const DEMO_USERS = [
  {
    nombre: 'Admin Nuevo',
    email: 'adminnuevo@agente.dev',
    password_salt: 'c3f4a8d29b7e4c1a9d6f2e8b5c4a7d90',
    password_hash: '72c7d60b47fa00be491f03c939ada18b8bbf5584eee1bb681a6b0b701dc181783d7cbe5b29d9bc8d6407b847a760e5bfa4b045e24597577a820c27e219b55c2f',
    role: 'admin'
  },
  {
    nombre: 'Operario Agente',
    email: 'operario@agente.dev',
    password_salt: '7070963e21ad75729efe9bb0d49c71f4',
    password_hash: 'bb95b3d030be61a13e8622c2c47e78140b2b87a57df0327d9542e9bcdc401b5521c2946408d78028debeaa81be77ad9649f4e33e035e07a3fa645ef109725130',
    role: 'operario'
  }
];

export async function ensureUsersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ops_usuarios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(140) NOT NULL,
      email VARCHAR(190) NOT NULL UNIQUE,
      password_salt VARCHAR(128) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'operario',
      estado VARCHAR(20) NOT NULL DEFAULT 'activo',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

export async function findUserByEmail(email) {
  await ensureUsersTable();

  const [rows] = await pool.query(
    `
      SELECT id, nombre, email, password_salt, password_hash, role, estado
      FROM ops_usuarios
      WHERE email = ?
      LIMIT 1
    `,
    [email]
  );

  return rows[0] || null;
}

export async function seedDemoUsers() {
  await ensureUsersTable();

  for (const user of DEMO_USERS) {
    await pool.query(
      `
        INSERT INTO ops_usuarios (
          nombre,
          email,
          password_salt,
          password_hash,
          role
        )
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          nombre = VALUES(nombre),
          password_salt = VALUES(password_salt),
          password_hash = VALUES(password_hash),
          role = VALUES(role)
      `,
      [user.nombre, user.email, user.password_salt, user.password_hash, user.role]
    );
  }
}
