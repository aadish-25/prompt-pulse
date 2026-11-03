const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

let token = sessionStorage.getItem('promptpulse_token') || '';
let providerKeys = {};

export function setToken(value) {
  token = value || '';
  if (token) sessionStorage.setItem('promptpulse_token', token);
  else sessionStorage.removeItem('promptpulse_token');
}

export function setProviderKeys(value) {
  providerKeys = value || {};
}

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (providerKeys.openrouter) headers.set('X-OpenRouter-Key', providerKeys.openrouter);
  if (providerKeys.groq) headers.set('X-Groq-Key', providerKeys.groq);
  if (providerKeys.deepseek) headers.set('X-DeepSeek-Key', providerKeys.deepseek);
  if (providerKeys.tavily) headers.set('X-Tavily-Key', providerKeys.tavily);

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const detail = payload?.detail;
    const message = typeof detail === 'string' ? detail : detail?.message || payload?.message || `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}
