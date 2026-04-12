import { Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

export function GastosHero({ resetForm }) {
  return (
    <div className="hero-panel caja-hero gastos-hero">
      <div>
        <p className="eyebrow">Gastos</p>
        <h1>Configuracion de costos</h1>
        <p className="empty-copy">Edita costos fijos y variables para estimar mejor la caja.</p>
      </div>
      <div className="gastos-hero-actions">
        <Button as={Link} to="/caja" variant="outline-dark">
          Volver a Caja
        </Button>
        <Button variant="dark" onClick={resetForm}>
          Nuevo gasto
        </Button>
      </div>
    </div>
  );
}
