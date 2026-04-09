const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export async function loginRequest(payload) {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error('No se pudo iniciar sesión');
  }

  return response.json();
}

export async function fetchProducts(limit = 5) {
  const response = await fetch(`${API_URL}/api/products`);

  if (!response.ok) {
    throw new Error('No se pudieron cargar los productos');
  }

  const data = await response.json();

  return (data.items || []).slice(0, limit);
}

export { API_URL };
