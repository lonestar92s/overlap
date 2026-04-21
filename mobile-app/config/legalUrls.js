/**
 * URLs for Terms and Privacy (served by the web app).
 * Set EXPO_PUBLIC_WEB_APP_URL (no trailing slash), e.g. https://your-app.example.com
 */
export function getLegalPageUrls() {
  const base = process.env.EXPO_PUBLIC_WEB_APP_URL?.replace(/\/$/, '');
  if (base) {
    return { termsUrl: `${base}/terms`, privacyUrl: `${base}/privacy` };
  }
  if (__DEV__) {
    return {
      termsUrl: 'http://localhost:3000/terms',
      privacyUrl: 'http://localhost:3000/privacy'
    };
  }
  return { termsUrl: null, privacyUrl: null };
}
