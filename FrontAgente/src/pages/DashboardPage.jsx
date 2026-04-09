import { useEffect, useState } from 'react';
import { Col, Row } from 'react-bootstrap';
import ProductsPanel from '../components/ProductsPanel';
import { useRealtimeFeed } from '../hooks/useRealtimeFeed';
import { fetchProducts } from '../services/api';
import RealtimePanel from '../components/RealtimePanel';
import StatsChart from '../components/StatsChart';

function DashboardPage() {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState('');

  useRealtimeFeed();

  useEffect(() => {
    let active = true;

    const loadProducts = async () => {
      try {
        setLoadingProducts(true);
        setProductsError('');
        const items = await fetchProducts(5);

        if (active) {
          setProducts(items);
        }
      } catch (error) {
        if (active) {
          setProductsError(error.message);
        }
      } finally {
        if (active) {
          setLoadingProducts(false);
        }
      }
    };

    loadProducts();

    return () => {
      active = false;
    };
  }, []);

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
        <Col xs={12}>
          <ProductsPanel products={products} loading={loadingProducts} error={productsError} />
        </Col>
      </Row>
    </section>
  );
}

export default DashboardPage;
