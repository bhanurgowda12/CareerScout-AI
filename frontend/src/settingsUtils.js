export const THEME_STORAGE_KEY = 'careerscout-theme-preference';

export function isValidUsername(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_]{3,20}$/.test(value.trim());
}

export function hasPasswordProvider(user) {
  return user?.providerData?.some((provider) => provider.providerId === 'password') ?? false;
}

export function readThemePreference(storage) {
  try {
    const availableStorage = storage ?? globalThis.localStorage;
    return availableStorage?.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function writeThemePreference(theme, storage) {
  const preference = theme === 'dark' ? 'dark' : 'light';
  try {
    const availableStorage = storage ?? globalThis.localStorage;
    availableStorage?.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    return preference;
  }
  return preference;
}