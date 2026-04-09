INSERT INTO ops_usuarios (
  nombre,
  email,
  password_salt,
  password_hash,
  role
) VALUES
  (
    'Admin Pro',
    'admin2@agente.dev',
    '77f4e846c0239cc92ff6f985eec09c9e',
    'fb6207f32b6a02aafec2019762287cecd7622cf3f449cc6e10f9c2a0c3fdeabb4a8047c38302d3a681692df021bd4aa7aa776402b64dd7b915d5fd5a86534999',
    'admin'
  ),
  (
    'Admin Agente',
    'admin@agente.dev',
    '8540e29bfd180b106db2820ccd481402',
    '2457a1206052a2eec47baa9769e84047ce2cbc1d4b236c78053729ae7c8b4759a6755cb59924daaa19315f77b432758235dae186349399f95bd382b25e8ffdca',
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
