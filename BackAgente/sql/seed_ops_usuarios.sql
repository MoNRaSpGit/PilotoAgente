INSERT INTO ops_usuarios (
  nombre,
  email,
  password_salt,
  password_hash,
  role
) VALUES
  (
    'Admin Nuevo',
    'adminnuevo@agente.dev',
    'c3f4a8d29b7e4c1a9d6f2e8b5c4a7d90',
    '72c7d60b47fa00be491f03c939ada18b8bbf5584eee1bb681a6b0b701dc181783d7cbe5b29d9bc8d6407b847a760e5bfa4b045e24597577a820c27e219b55c2f',
    'admin'
  ),
  (
    'Operario Agente',
    'operario@agente.dev',
    '7070963e21ad75729efe9bb0d49c71f4',
    'bb95b3d030be61a13e8622c2c47e78140b2b87a57df0327d9542e9bcdc401b5521c2946408d78028debeaa81be77ad9649f4e33e035e07a3fa645ef109725130',
    'operario'
  )
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  password_salt = VALUES(password_salt),
  password_hash = VALUES(password_hash),
  role = VALUES(role);
