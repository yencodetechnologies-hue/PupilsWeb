export const SITE_ORIGIN = "https://pupils-web.vercel.app";
export const API_ORIGIN = "https://pupilsweb.yencodetechnologies.in";

export function joinUrl(code) {
  return `${SITE_ORIGIN}/join/${code}`;
}

export function apiUrl(path) {
  return `${API_ORIGIN}${path}`;
}
