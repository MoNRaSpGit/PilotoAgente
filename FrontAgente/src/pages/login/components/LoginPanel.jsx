import { BotMessageSquare, Power } from 'lucide-react';
import { Button, Form } from 'react-bootstrap';

export function LoginPanel({
  form,
  loading,
  panelUnlocked,
  handleChange,
  handleSubmit,
  handleQuickLogin,
  handleLogoTap,
  handleCloseApp
}) {
  return (
    <div className="card-panel login-secret-panel">
      <div className="panel-heading">
        <div>
          <h1>Ingresar</h1>
          <p>Acceso al panel operativo.</p>
        </div>
        <button type="button" className="login-secret-logo" onClick={handleLogoTap} aria-label="FrontAgente">
          <BotMessageSquare size={20} />
          <span>FrontAgente</span>
        </button>
      </div>

      {panelUnlocked ? (
        <>
          <div className="d-flex gap-2 mb-3 flex-wrap">
            <Button type="button" variant="dark" disabled={loading} onClick={() => handleQuickLogin('admin')}>
              Entrar como admin
            </Button>
            <Button type="button" variant="outline-dark" disabled={loading} onClick={() => handleQuickLogin('operario')}>
              Entrar como operario
            </Button>
            <Button
              type="button"
              variant="outline-primary"
              disabled={loading}
              onClick={() => handleQuickLogin('operarioOficina')}
            >
              Entrar como operario oficina
            </Button>
            <Button type="button" variant="outline-danger" disabled={loading} onClick={handleCloseApp}>
              <Power size={16} className="me-1" />
              Cerrar app
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
        </>
      ) : (
        <Form onSubmit={(event) => event.preventDefault()}>
          <Form.Group className="mb-3">
            <Form.Label>Email</Form.Label>
            <Form.Control type="email" value="usuario@empresa.com" disabled readOnly />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Password</Form.Label>
            <Form.Control type="password" value="********" disabled readOnly />
          </Form.Group>

          <Button type="submit" disabled>
            Iniciar sesion
          </Button>
        </Form>
      )}
    </div>
  );
}
