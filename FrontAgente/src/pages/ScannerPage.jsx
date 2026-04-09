import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Col, Form, Row, Table } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { scanProductByBarcode } from '../services/api';

function resolveProductImage(imageValue) {
  if (!imageValue) {
    return '';
  }

  if (imageValue.startsWith('http://') || imageValue.startsWith('https://') || imageValue.startsWith('data:image/')) {
    return imageValue;
  }

  return `data:image/jpeg;base64,${imageValue}`;
}

function ScannerPage() {
  const inputRef = useRef(null);
  const [barcode, setBarcode] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastScanMeta, setLastScanMeta] = useState(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const summary = useMemo(() => {
    const totalUnits = items.reduce((accumulator, item) => accumulator + item.quantity, 0);
    const totalAmount = items.reduce((accumulator, item) => accumulator + item.total, 0);
    const averageMs =
      items.length > 0
        ? items.reduce((accumulator, item) => accumulator + item.lastDurationMs, 0) / items.length
        : 0;

    return {
      totalUnits,
      totalAmount,
      averageMs: Number(averageMs.toFixed(2))
    };
  }, [items]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!barcode.trim()) {
      return;
    }

    setLoading(true);

    try {
      const { item, meta } = await scanProductByBarcode(barcode);
      const price = Number(item.precio_venta);
      const normalizedBarcode = item.barcode_normalized || item.barcode || barcode.trim();

      setItems((current) => {
        const existingIndex = current.findIndex((entry) => entry.barcode === normalizedBarcode);

        if (existingIndex >= 0) {
          const next = [...current];
          const existing = next[existingIndex];
          const quantity = existing.quantity + 1;

          next[existingIndex] = {
            ...existing,
            quantity,
            total: Number((quantity * existing.price).toFixed(2)),
            imageUrl: existing.imageUrl || resolveProductImage(item.imagen),
            hasImage: Boolean(existing.hasImage || (item.tiene_imagen && item.imagen)),
            lastDurationMs: meta.durationMs,
            lastSource: meta.source
          };

          return next;
        }

        return [
          {
            id: item.id,
            barcode: normalizedBarcode,
            name: item.nombre,
            price,
            quantity: 1,
            total: Number(price.toFixed(2)),
            category: item.categoria,
            stock: item.stock_actual,
            imageUrl: resolveProductImage(item.imagen),
            hasImage: Boolean(item.tiene_imagen && item.imagen),
            lastDurationMs: meta.durationMs,
            lastSource: meta.source
          },
          ...current
        ];
      });

      setLastScanMeta({
        durationMs: meta.durationMs,
        source: meta.source,
        name: item.nombre
      });
      setBarcode('');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const clearTicket = () => {
    setItems([]);
    setLastScanMeta(null);
    setBarcode('');
    inputRef.current?.focus();
  };

  return (
    <section className="page-section">
      <div className="hero-panel">
        <p className="eyebrow">Escaner + cache + metricas</p>
        <h1>Escanear productos por codigo de barras</h1>
        <p>
          Esta vista consulta el backend una sola vez por codigo y reutiliza cache en cliente y servidor para acelerar
          lecturas repetidas.
        </p>
      </div>

      <Row className="g-4">
        <Col xl={4}>
          <div className="card-panel">
            <div className="panel-heading">
              <div>
                <h3>Nuevo escaneo</h3>
                <p>Ideal para lector fisico o ingreso manual.</p>
              </div>
            </div>

            <Form onSubmit={handleSubmit} className="scanner-form">
              <Form.Group>
                <Form.Label>Codigo de barras</Form.Label>
                <Form.Control
                  ref={inputRef}
                  name="barcode"
                  value={barcode}
                  onChange={(event) => setBarcode(event.target.value)}
                  placeholder="Escanea o escribi el codigo"
                  autoComplete="off"
                  inputMode="numeric"
                />
              </Form.Group>

              <div className="scanner-actions">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Buscando...' : 'Agregar producto'}
                </Button>
                <Button type="button" variant="outline-secondary" onClick={clearTicket}>
                  Limpiar lista
                </Button>
              </div>
            </Form>

            <div className="scanner-metrics">
              <div className="metric-card">
                <span>Items</span>
                <strong>{items.length}</strong>
              </div>
              <div className="metric-card">
                <span>Unidades</span>
                <strong>{summary.totalUnits}</strong>
              </div>
              <div className="metric-card">
                <span>Total</span>
                <strong>${summary.totalAmount.toFixed(2)}</strong>
              </div>
              <div className="metric-card">
                <span>Promedio</span>
                <strong>{summary.averageMs} ms</strong>
              </div>
            </div>

            <div className="last-scan">
              <h4>Ultimo resultado</h4>
              {lastScanMeta ? (
                <div className="last-scan-copy">
                  <strong>{lastScanMeta.name}</strong>
                  <span>{lastScanMeta.durationMs} ms</span>
                  <Badge bg={lastScanMeta.source.includes('cache') ? 'success' : 'primary'}>
                    {lastScanMeta.source}
                  </Badge>
                </div>
              ) : (
                <p className="empty-copy">Todavia no se escaneo ningun producto.</p>
              )}
            </div>
          </div>
        </Col>

        <Col xl={8}>
          <div className="card-panel">
            <div className="panel-heading">
              <div>
                <h3>Lista tipo ticket</h3>
                <p>Producto, precio, cantidad, total y origen de la ultima resolucion.</p>
              </div>
            </div>

            {items.length === 0 ? (
              <p className="empty-copy">Escanea un producto para empezar a armar la lista.</p>
            ) : (
              <div className="table-responsive">
                <Table hover className="scanner-table align-middle">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Precio</th>
                      <th>Cantidad</th>
                      <th>Total</th>
                      <th>Tiempo</th>
                      <th>Origen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.barcode}>
                        <td>
                          <div className="scanner-product-cell">
                            {item.hasImage ? (
                              <img className="scanner-product-image" src={item.imageUrl} alt={item.name} loading="lazy" />
                            ) : (
                              <div className="scanner-product-fallback">IMG</div>
                            )}
                            <div>
                              <strong>{item.name}</strong>
                              <div className="table-subcopy">
                                {item.category || 'Sin categoria'} | Stock {item.stock}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>${item.price.toFixed(2)}</td>
                        <td>{item.quantity}</td>
                        <td>${item.total.toFixed(2)}</td>
                        <td>{item.lastDurationMs} ms</td>
                        <td>
                          <Badge bg={item.lastSource.includes('cache') ? 'success' : 'primary'}>
                            {item.lastSource}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </div>
        </Col>
      </Row>
    </section>
  );
}

export default ScannerPage;
