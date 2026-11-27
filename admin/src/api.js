// Same-origin calls to the Worker's admin API. Cloudflare Access adds the sign-in cookie.
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, form } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: form ?? (body ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(payload.error || `Request failed (${response.status}).`, response.status);
  return payload;
}

export const api = {
  session: () => request('/api/admin/session'),
  orders: () => request('/api/admin/orders'),
  updateOrder: (reference, changes) => request(`/api/admin/orders/${reference}`, { method: 'PATCH', body: changes }),
  menu: () => request('/api/admin/menu'),
  createItem: (item) => request('/api/admin/menu/items', { method: 'POST', body: item }),
  updateItem: (id, item) => request(`/api/admin/menu/items/${id}`, { method: 'PUT', body: item }),
  setAvailability: (id, available) => request(`/api/admin/menu/items/${id}/availability`, { method: 'PUT', body: { available } }),
  deleteItem: (id) => request(`/api/admin/menu/items/${id}`, { method: 'DELETE' }),
  uploadPhoto: (full, thumbnail) => {
    const form = new FormData();
    form.append('image', full, 'photo');
    form.append('thumbnail', thumbnail, 'photo-320');
    return request('/api/admin/uploads', { method: 'POST', form });
  },
};
