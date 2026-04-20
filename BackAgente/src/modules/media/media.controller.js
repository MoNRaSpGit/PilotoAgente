import {
  getMediaProviderStatus,
  migrateProductImagesToCloudinary,
  uploadProductImage
} from './media.service.js';

function handleServiceError(res, error, fallbackMessage) {
  const status = error.status || 500;

  return res.status(status).json({
    message: error.message || fallbackMessage
  });
}

export async function getMediaStatusController(_req, res) {
  try {
    const item = getMediaProviderStatus();
    return res.json({ item });
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo obtener estado de media');
  }
}

export async function uploadProductImageController(req, res) {
  try {
    const data = await uploadProductImage(req.body);
    return res.status(201).json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo subir imagen a Cloudinary');
  }
}

export async function migrateProductImagesController(req, res) {
  try {
    const data = await migrateProductImagesToCloudinary(req.query);
    return res.json(data);
  } catch (error) {
    return handleServiceError(res, error, 'No se pudo migrar imagenes de productos a Cloudinary');
  }
}
