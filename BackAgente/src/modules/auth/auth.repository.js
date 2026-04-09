import { pool } from '../../config/db.js';

const DEMO_USERS = [
  {
    nombre: 'Admin Pro',
    email: 'admin2@agente.dev',
    password_salt: '77f4e846c0239cc92ff6f985eec09c9e',
    password_hash: 'fb6207f32b6a02aafec2019762287cecd7622cf3f449cc6e10f9c2a0c3fdeabb4a8047c38302d3a681692df021bd4aa7aa776402b64dd7b915d5fd5a86534999',
    role: 'admin'
  },
  {
    nombre: 'Admin Agente',
    email: 'admin@agente.dev',
    password_salt: '8540e29bfd180b106db2820ccd481402',
    password_hash: '2457a1206052a2eec47baa9769e84047ce2cbc1d4b236c78053729ae7c8b4759a6755cb59924daaa19315f77b432758235dae186349399f95bd382b25e8ffdca',
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
