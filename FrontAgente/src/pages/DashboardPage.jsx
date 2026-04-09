import { Col, Row } from 'react-bootstrap';
import { useRealtimeFeed } from '../hooks/useRealtimeFeed';
import RealtimePanel from '../components/RealtimePanel';
import StatsChart from '../components/StatsChart';

function DashboardPage() {
  useRealtimeFeed();

  return (
    <section className="page-section">
      <div className="hero-panel">
        <p className="eyebrow">React + Redux Toolkit + SSE</p>
        <h1>Base inicial del panel del agente</h1>
        <p>
          Esta pantalla ya queda lista para conectar autenticación, dashboard de métricas y eventos en tiempo real.
        </p>
      </div>

      <Row className="g-4">
        <Col lg={7}>
          <StatsChart />
        </Col>
        <Col lg={5}>
          <RealtimePanel />
        </Col>
      </Row>
    </section>
  );
}

export default DashboardPage;
