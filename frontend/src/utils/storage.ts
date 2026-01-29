export const safeJSONParse = (item: string | null, fallback: any = {}) => {
  if (!item || item === 'undefined') return fallback;
  try {
    return JSON.parse(item);
  } catch (e) {
    console.error('JSON parse error:', e, 'for item:', item);
    return fallback;
  }
};

export const storage = {
  get: (key: string, fallback: any = {}) => {
    return safeJSONParse(localStorage.getItem(key), fallback);
  },
  set: (key: string, value: any) => {
    localStorage.setItem(key, JSON.stringify(value));
  },
  remove: (key: string) => {
    localStorage.removeItem(key);
  }
};
