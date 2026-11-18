export async function api(path, options = {}) {
  const { body, ...rest } = options;
  let res;
  try {
    res = await fetch(`/api/${path}`, {
      credentials: 'same-origin',
      ...rest,
      headers: {
        'X-Causalytix-Client': 'workspace',
        ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...rest.headers,
      },
      body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('Cannot reach the local workspace. Check the server and try again.');
  }
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(
      typeof error.detail === 'string' ? error.detail : `Request failed (${res.status}).`,
    );
  }
  return res.json();
}
export function go(path) {
  const next = '#/' + path.replace(/^\/?/, '');
  if (location.hash !== next) location.hash = next;
}
export function dt(date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}
export function age(date) {
  const hours = Math.max(0, Math.floor((Date.now() - Date.parse(date)) / 3600000));
  return hours === 0 ? 'Just now' : hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}
export const count = (n) => String(n).padStart(2, '0');
export function downloadJSON(name, data) {
  const u = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
