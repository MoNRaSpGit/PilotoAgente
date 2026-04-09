export function profileController(req, res) {
  return res.json({
    message: 'Ruta protegida activa',
    user: req.user
  });
}
