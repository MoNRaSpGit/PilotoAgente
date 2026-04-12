import { Badge } from 'react-bootstrap';
import { formatLongDate } from '../cajaPage.utils';

function CajaHero({ isOpen, openCashboxInfo }) {
  return (
    <div className="hero-panel caja-hero caja-hero-minimal">
      <div className="caja-hero-copy">
        <p className="eyebrow">Caja</p>
        <h1>Control en vivo</h1>
        <p className="caja-hero-subtitle">{formatLongDate()} · seguimiento fino de caja, scanner y movimientos.</p>
      </div>
      <div className="caja-hero-status">
        <Badge bg={isOpen ? 'success' : 'secondary'}>{isOpen ? 'Abierta' : 'Cerrada'}</Badge>
        {isOpen && openCashboxInfo ? <span>{openCashboxInfo.opened_by_name}</span> : <span>Lista para abrir</span>}
      </div>
    </div>
  );
}

export default CajaHero;
