export const API_ORIGIN = "https://pupilsweb.yencodetechnologies.in";

export function joinUrl(code) {
  return `${window.location.origin}/join/${code}`;
}

export function apiUrl(path) {
  return `${API_ORIGIN}${path}`;
}
