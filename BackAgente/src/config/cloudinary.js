import { v2 as cloudinary } from 'cloudinary';
import { env } from './env.js';

let configured = false;

function hasCredentials() {
  return Boolean(env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret);
}

export function isCloudinaryEnabled() {
  return hasCredentials();
}

export function getCloudinaryClient() {
  if (!hasCredentials()) {
    return null;
  }

  if (!configured) {
    cloudinary.config({
      cloud_name: env.cloudinaryCloudName,
      api_key: env.cloudinaryApiKey,
      api_secret: env.cloudinaryApiSecret,
      secure: true
    });
    configured = true;
  }

  return cloudinary;
}