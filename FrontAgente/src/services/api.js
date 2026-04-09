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

export { API_URL };
