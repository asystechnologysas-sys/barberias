export const api = {
  get: async (url: string) => {
    const token = localStorage.getItem('asys_token');
    const res = await fetch(url, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Error de conexión');
    return data.data;
  },
  post: async (url: string, body: any) => {
    const token = localStorage.getItem('asys_token');
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Error en la solicitud');
    return data.data;
  },
  patch: async (url: string, body: any) => {
    const token = localStorage.getItem('asys_token');
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Error al actualizar');
    return data.data;
  }
};