import {
  getAdminUserDetail,
  getAdminUsersSummary,
  getWebAuthProfile,
  listAdminUsers
} from './webUsers.service.js';

function handleServiceError(res, error, fallbackMessage) {
  const status = error.status || 500;

  return res.status(status).json({
    message: error.message || fallbackMessage,
    ...(error.item ? { item: error.item } : {}),
    ...(error.items ? { items: error.items } : {})
  });
}

export async function getWebMyProfileController(req, res) {
  try {
    const data = await getWebAuthProfile(req.webUser?.id);
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo obtener el perfil web');
  }
}

export async function getAdminUsersSummaryController(_req, res) {
  try {
    const data = await getAdminUsersSummary();
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo obtener el resumen de usuarios web');
  }
}

export async function listAdminUsersController(req, res) {
  try {
    const data = await listAdminUsers(req.query);
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo listar usuarios web');
  }
}

export async function getAdminUserDetailController(req, res) {
  try {
    const data = await getAdminUserDetail(req.params.webUserId);
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo obtener el detalle del usuario web');
  }
}