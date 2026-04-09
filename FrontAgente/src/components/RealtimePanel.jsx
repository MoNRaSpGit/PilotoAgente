import { Badge } from 'react-bootstrap';
import { useSelector } from 'react-redux';

function RealtimePanel() {
  const { status, events } = useSelector((state) => state.realtime);

  return (
    <div className="card-panel">
      <div className="panel-heading">
        <h3>Eventos en tiempo real</h3>
        <Badge bg={status === 'connected' ? 'success' : 'secondary'}>{status}</Badge>
      </div>

      <div className="event-list">
        {events.length === 0 ? (
          <p className="empty-copy">Todavía no llegaron eventos desde el backend SSE.</p>
        ) : (
          events.map((item) => (
            <div className="event-item" key={item.id}>
              <strong>{item.type}</strong>
              <span>{item.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default RealtimePanel;
