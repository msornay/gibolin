export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

function getCsrfToken(): string {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : '';
}

export function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method ?? 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    options.headers = {
      ...options.headers,
      'X-CSRFToken': getCsrfToken(),
    };
  }
  return fetch(url, options);
}
