export const professionalLinkFields = [
  { key: 'linkedin', label: 'LinkedIn', allowHttp: false },
  { key: 'github', label: 'GitHub', allowHttp: false },
  { key: 'portfolio', label: 'Portfolio', allowHttp: true },
  { key: 'leetcode', label: 'LeetCode', allowHttp: false },
  { key: 'hackerrank', label: 'HackerRank', allowHttp: false },
];

export function normalizeProfileUrl(value, allowHttp = false) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (!candidate) return '';

  try {
    const url = new URL(candidate);
    const permittedProtocols = allowHttp ? ['https:', 'http:'] : ['https:'];
    if (!permittedProtocols.includes(url.protocol) || !url.hostname) return '';
    return url.href;
  } catch {
    return '';
  }
}

export function validateProfessionalLinks(profile) {
  return professionalLinkFields.reduce((errors, field) => {
    const value = typeof profile?.[field.key] === 'string' ? profile[field.key].trim() : '';
    if (value && !normalizeProfileUrl(value, field.allowHttp)) {
      errors[field.key] = field.allowHttp
        ? 'Enter a valid portfolio URL beginning with https:// or http://.'
        : 'Enter a valid URL beginning with https://.';
    }
    return errors;
  }, {});
}

export function mergeProfileUpdates(currentProfile, updates) {
  return { ...(currentProfile || {}), ...(updates || {}) };
}

export const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024;
export const MAX_AVATAR_DIMENSION = 512;

export async function validateAvatarFile(file) {
  if (!file) return { valid: false, error: 'Choose an image file.' };
  if (file.size > MAX_AVATAR_FILE_SIZE) {
    return { valid: false, error: 'Choose an image smaller than 5 MB.' };
  }

  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a;
  const isWebp = bytes[0] === 0x52
    && bytes[1] === 0x49
    && bytes[2] === 0x46
    && bytes[3] === 0x46
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50;
  const actualType = isJpeg ? 'image/jpeg' : isPng ? 'image/png' : isWebp ? 'image/webp' : '';

  if (!actualType) {
    return { valid: false, error: 'This file is not a valid JPEG, PNG, or WebP image.' };
  }
  if (file.type && file.type !== actualType && !(file.type === 'image/jpg' && actualType === 'image/jpeg')) {
    return { valid: false, error: 'The selected image format does not match the file content.' };
  }
  return { valid: true, error: '', type: actualType };
}

export async function processAvatarImage(file) {
  if (typeof createImageBitmap !== 'function') {
    throw new Error('Your browser cannot process this image. Try a current version of Chrome, Edge, Firefox, or Safari.');
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('The selected image could not be decoded. Choose a valid JPEG, PNG, or WebP image.');
  }

  try {
    const scale = Math.min(1, MAX_AVATAR_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('The image could not be prepared for upload. Please try again.');
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result);
          else reject(new Error('The image could not be prepared for upload. Please try again.'));
        },
        'image/jpeg',
        0.84,
      );
    });
    return blob;
  } finally {
    bitmap.close();
  }
}

export function isOwnedAvatarPath(path, uid) {
  if (typeof path !== 'string' || typeof uid !== 'string') return false;
  const prefix = `users/${uid}/profile/avatar-`;
  if (!path.startsWith(prefix) || !path.endsWith('.jpg')) return false;
  const filename = path.slice(prefix.length, -'.jpg'.length);
  return /^[A-Za-z0-9-]+$/.test(filename);
}
