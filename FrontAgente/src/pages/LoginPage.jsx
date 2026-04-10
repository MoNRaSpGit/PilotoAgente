import { useEffect, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { loginRequest } from '../services/api';
import { setSession } from '../store/slices/authSlice';
import { saveAuthSession } from '../utils/authSession';

const QUICK_LOGINS = {
  admin: {
    email: 'adminnuevo@agente.dev',
    password: 'AdminNuevo2026!'
  },
  operario: {
    email: 'operario@agente.dev',
    password: 'OperarioDemo2026!'
  }
};

function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const sessionUserRole = useSelector((state) => state.auth.user?.role);
  const sessionToken = useSelector((state) => state.auth.token);
  const [form, setForm] = useState({
    email: QUICK_LOGINS.admin.email,
    password: QUICK_LOGINS.admin.password
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionToken || !sessionUserRole) {
      return;
    }

    navigate(sessionUserRole === 'admin' ? '/' : '/scanner', { replace: true });
  }, [navigate, sessionToken, sessionUserRole]);

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
      saveAuthSession(data);
      toast.success('Sesion iniciada');
      navigate(data.user?.role === 'admin' ? '/' : '/scanner', { replace: true });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (role) => {
    const credentials = QUICK_LOGINS[role];

    if (!credentials) {
      return;
    }

    setForm(credentials);
    setLoading(true);

    try {
      const data = await loginRequest(credentials);
      dispatch(setSession(data));
      saveAuthSession(data);
      toast.success('Sesion iniciada');
      navigate(data.user?.role === 'admin' ? '/' : '/scanner', { replace: true });
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
          <p>Login conectado al backend con roles.</p>
        </div>

        <div className="d-flex gap-2 mb-3 flex-wrap">
          <Button type="button" variant="dark" disabled={loading} onClick={() => handleQuickLogin('admin')}>
            Entrar como admin
          </Button>
          <Button type="button" variant="outline-dark" disabled={loading} onClick={() => handleQuickLogin('operario')}>
            Entrar como operario
          </Button>
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
            {loading ? 'Ingresando...' : 'Iniciar sesion'}
          </Button>
        </Form>
      </div>
    </section>
  );
}

export default LoginPage;
