import { useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { useDispatch } from 'react-redux';
import { loginRequest } from '../services/api';
import { setSession } from '../store/slices/authSlice';

function LoginPage() {
  const dispatch = useDispatch();
  const [form, setForm] = useState({
    email: 'admin@agente.dev',
    password: '123456'
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      const data = await loginRequest(form);
      dispatch(setSession(data));
      toast.success('Sesión iniciada');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="page-section narrow-section">
      <div className="card-panel">
        <div className="panel-heading">
          <h1>Ingresar</h1>
          <p>Login de ejemplo conectado al backend Express con JWT.</p>
        </div>

        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Email</Form.Label>
            <Form.Control type="email" name="email" value={form.email} onChange={handleChange} />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Password</Form.Label>
            <Form.Control type="password" name="password" value={form.password} onChange={handleChange} />
          </Form.Group>

          <Button type="submit" disabled={loading}>
            {loading ? 'Ingresando...' : 'Iniciar sesión'}
          </Button>
        </Form>
      </div>
    </section>
  );
}

export default LoginPage;
