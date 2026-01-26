export const getFirebaseConfig = () => {
  try {
    if (typeof __firebase_config !== 'undefined') {
      return typeof __firebase_config === 'string' ? JSON.parse(__firebase_config) : __firebase_config;
    }
  } catch (e) { console.warn("Firebase config error:", e); }
  return null;
};
export const appId = typeof __app_id !== 'undefined' ? __app_id : 'mythic-realms-v19';