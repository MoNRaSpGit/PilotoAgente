import { env } from '../../config/env.js';
import { getCloudinaryClient, isCloudinaryEnabled } from '../../config/cloudinary.js';
import {
  ensureProductImageColumns,
  listProductsForCloudinaryMigration,
  updateProductCloudinaryImage
} from './media.repository.js';

function createServiceError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function getMediaProviderStatus() {
  return {
    cloudinary_enabled: isCloudinaryEnabled(),
    cloud_name: env.cloudinaryCloudName || null,
    product_folder: env.cloudinaryProductFolder
  };
}

function toUploadableImageSource(imageValue) {
  if (!imageValue) {
    return null;
  }

  if (Buffer.isBuffer(imageValue)) {
    return `data:image/jpeg;base64,${imageValue.toString('base64')}`;
  }

  const rawValue = String(imageValue).trim();
  if (!rawValue) {
    return null;
  }

  if (/^https?:\/\//i.test(rawValue) || /^data:image\//i.test(rawValue)) {
    return rawValue;
  }

  const normalized = rawValue.replace(/\s/g, '');
  const looksLikeBase64 = normalized.length > 120 && /^[A-Za-z0-9+/=]+$/.test(normalized);

  if (looksLikeBase64) {
    return `data:image/jpeg;base64,${normalized}`;
  }

  return null;
}

export async function uploadProductImage(payload = {}) {
  if (!isCloudinaryEnabled()) {
    throw createServiceError('Cloudinary no esta configurado en el servidor', 503);
  }

  const file = String(payload?.file || '').trim();
  const folder = String(payload?.folder || env.cloudinaryProductFolder || 'pilotoagente/products').trim();
  const publicId = String(payload?.public_id || payload?.publicId || '').trim();

  if (!file) {
    throw createServiceError('Archivo requerido (data URL o URL publica)', 400);
  }

  const cloudinary = getCloudinaryClient();
  if (!cloudinary) {
    throw createServiceError('Cloudinary no disponible', 503);
  }

  const options = {
    folder,
    resource_type: 'image',
    overwrite: true
  };

  if (publicId) {
    options.public_id = publicId;
  }

  const result = await cloudinary.uploader.upload(file, options);

  return {
    item: {
      public_id: result.public_id,
      secure_url: result.secure_url,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
      folder
    }
  };
}

export async function migrateProductImagesToCloudinary(query = {}) {
  await ensureProductImageColumns();

  if (!isCloudinaryEnabled()) {
    throw createServiceError('Cloudinary no esta configurado en el servidor', 503);
  }

  const rawLimit = Number(query?.limit);
  const rawOffset = Number(query?.offset);
  const limit = Number.isFinite(rawLimit) ? rawLimit : 50;
  const offset = Number.isFinite(rawOffset) ? rawOffset : 0;
  const safeLimit = Math.max(1, Math.min(300, Math.floor(Number(limit) || 50)));
  const safeOffset = Math.max(0, Math.floor(Number(offset) || 0));

  const cloudinary = getCloudinaryClient();
  if (!cloudinary) {
    throw createServiceError('Cloudinary no disponible', 503);
  }

  const items = await listProductsForCloudinaryMigration({ limit: safeLimit, offset: safeOffset });
  const summary = {
    scanned: items.length,
    migrated: 0,
    skipped: 0,
    errors: 0
  };
  const results = [];

  for (const item of items) {
    const source = toUploadableImageSource(item.imagen);

    if (!source) {
      summary.skipped += 1;
      results.push({
        product_id: item.id,
        nombre: item.nombre,
        status: 'skipped',
        reason: 'Formato de imagen no compatible para migracion automatica'
      });
      continue;
    }

    try {
      const uploadResult = await cloudinary.uploader.upload(source, {
        folder: env.cloudinaryProductFolder,
        resource_type: 'image',
        overwrite: true,
        public_id: `product-${item.id}`
      });

      await updateProductCloudinaryImage({
        productId: item.id,
        imageUrl: uploadResult.secure_url,
        imagePublicId: uploadResult.public_id
      });

      summary.migrated += 1;
      results.push({
        product_id: item.id,
        nombre: item.nombre,
        status: 'migrated',
        secure_url: uploadResult.secure_url
      });
    } catch (error) {
      summary.errors += 1;
      results.push({
        product_id: item.id,
        nombre: item.nombre,
        status: 'error',
        reason: error?.message || 'Error desconocido al subir a Cloudinary'
      });
    }
  }

  return {
    items: results,
    summary,
    page: {
      limit: safeLimit,
      offset: safeOffset
    }
  };
}
