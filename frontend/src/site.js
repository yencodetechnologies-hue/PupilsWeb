// In local dev, call /api on this site so Vite can keep the session cookie.
// The built site talks to the API host directly.
export const API_ORIGIN = import.meta.env.DEV ? "" : "https://pupilsweb.yencodetechnologies.in";

export function joinUrl(code) {
  return `${window.location.origin}/join/${code}`;
}

export function apiUrl(path) {
  return `${API_ORIGIN}${path}`;
}
