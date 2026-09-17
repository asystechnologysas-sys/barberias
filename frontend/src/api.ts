const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.asysdigital.com';

export const api = {
  get: async (url: string) => {
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    const fullUrl = cleanPath.startsWith('http') ? cleanPath : `${API_BASE_URL}${cleanPath}`;
    const token = localStorage.getItem('asys_token');
    const res = await fetch(fullUrl, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error?.message || 'Error de conexión');
    return data.data;
  },
  post: async (url: string, body: any) => {
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    const fullUrl = cleanPath.startsWith('http') ? cleanPath : `${API_BASE_URL}${cleanPath}`;
    const token = localStorage.getItem('asys_token');
    const res = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error?.message || 'Error en la solicitud');
    return data.data;
  },
  upload: async (url: string, formData: FormData) => {
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    const fullUrl = cleanPath.startsWith('http') ? cleanPath : `${API_BASE_URL}${cleanPath}`;
    const token = localStorage.getItem('asys_token');
    const res = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: formData
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error?.message || 'Error al subir archivo');
    return data.data;
  },
  put: async (url: string, body: any) => {
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    const fullUrl = cleanPath.startsWith('http') ? cleanPath : `${API_BASE_URL}${cleanPath}`;
    const token = localStorage.getItem('asys_token');
    const res = await fetch(fullUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error?.message || 'Error al guardar');
    return data.data;
  },
  patch: async (url: string, body: any) => {
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    const fullUrl = cleanPath.startsWith('http') ? cleanPath : `${API_BASE_URL}${cleanPath}`;
    const token = localStorage.getItem('asys_token');
    const res = await fetch(fullUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error?.message || 'Error al actualizar');
    return data.data;
  },
  delete: async (url: string) => {
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    const fullUrl = cleanPath.startsWith('http') ? cleanPath : `${API_BASE_URL}${cleanPath}`;
    const token = localStorage.getItem('asys_token');
    const res = await fetch(fullUrl, {
      method: 'DELETE',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error?.message || 'Error al eliminar');
    return data.data;
  }
};