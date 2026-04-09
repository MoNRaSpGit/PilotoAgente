import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Col, Form, Modal, Row, Table } from 'react-bootstrap';
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
  const barcodeInputRef = useRef(null);
  const manualPriceRef = useRef(null);
  const [barcode, setBarcode] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastScanMeta, setLastScanMeta] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (manualOpen) {
      setTimeout(() => manualPriceRef.current?.focus(), 0);
    }
  }, [manualOpen]);

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

  const pushProduct = (nextItem) => {
    setItems((current) => {
      const existingIndex = current.findIndex((entry) => entry.key === nextItem.key);

      if (existingIndex >= 0) {
        const next = [...current];
        const existing = next[existingIndex];
        const quantity = existing.quantity + 1;

        next[existingIndex] = {
          ...existing,
          quantity,
          total: Number((quantity * existing.price).toFixed(2)),
          imageUrl: existing.imageUrl || nextItem.imageUrl,
          hasImage: Boolean(existing.hasImage || nextItem.hasImage),
          lastDurationMs: nextItem.lastDurationMs,
          lastSource: nextItem.lastSource
        };

        return next;
      }

      return [nextItem, ...current];
    });
  };

  const handleScanSubmit = async (event) => {
    event.preventDefault();

    if (!barcode.trim()) {
      return;
    }

    setLoading(true);

    try {
      const { item, meta } = await scanProductByBarcode(barcode);
      const price = Number(item.precio_venta);
      const normalizedBarcode = item.barcode_normalized || item.barcode || barcode.trim();

      pushProduct({
        key: normalizedBarcode,
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
      barcodeInputRef.current?.focus();
    }
  };

  const handleManualConfirm = () => {
    const parsedPrice = Number(manualPrice);

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      toast.error('Ingresá un precio válido');
      return;
    }

    pushProduct({
      key: 'manual-product',
      id: 'manual-product',
      barcode: 'manual-product',
      name: 'Producto manual',
      price: parsedPrice,
      quantity: 1,
      total: Number(parsedPrice.toFixed(2)),
      category: 'Manual',
      stock: null,
      imageUrl: '',
      hasImage: false,
      lastDurationMs: 0,
      lastSource: 'manual'
    });

    setLastScanMeta({
      durationMs: 0,
      source: 'manual',
      name: 'Producto manual'
    });
    setManualPrice('');
    setManualOpen(false);
    barcodeInputRef.current?.focus();
  };

  const clearTicket = () => {
    setItems([]);
    setLastScanMeta(null);
    setBarcode('');
    setManualPrice('');
    setManualOpen(false);
    barcodeInputRef.current?.focus();
  };

  return (
    <section className="scanner-55 page-section">
      <div className="hero-panel scanner-hero">
        <p className="eyebrow">Modo simple para +55</p>
        <h1>Escaner rapido</h1>
        <p>Un solo input grande arriba. Escaneas, confirmas y el ticket se arma abajo.</p>
      </div>

      <Row className="g-4">
        <Col xl={5}>
          <div className="card-panel scanner-main-card">
            <Form onSubmit={handleScanSubmit} className="scanner-main-form">
              <Form.Group>
                <Form.Label className="scanner-label">Codigo de barras</Form.Label>
                <Form.Control
                  ref={barcodeInputRef}
                  className="scanner-big-input"
                  name="barcode"
                  value={barcode}
                  onChange={(event) => setBarcode(event.target.value)}
                  placeholder="Escaneá aqui"
                  autoComplete="off"
                  inputMode="numeric"
                />
              </Form.Group>

              <div className="scanner-actions scanner-actions-stacked">
                <Button type="submit" size="lg" disabled={loading}>
                  {loading ? 'Buscando...' : 'Confirmar escaneo'}
                </Button>
                <Button type="button" size="lg" variant="outline-dark" onClick={() => setManualOpen(true)}>
                  Producto Manual
                </Button>
                <Button type="button" size="lg" variant="outline-secondary" onClick={clearTicket}>
                  Limpiar lista
                </Button>
              </div>
            </Form>

            <div className="scanner-metrics scanner-metrics-simple">
              <div className="metric-card">
                <span>Lineas</span>
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

        <Col xl={7}>
          <div className="card-panel">
            <div className="panel-heading">
              <div>
                <h3>Ticket</h3>
                <p>Producto, precio, cantidad y total en lectura grande.</p>
              </div>
            </div>

            {items.length === 0 ? (
              <p className="empty-copy">Escaneá un producto para empezar.</p>
            ) : (
              <div className="table-responsive">
                <Table hover className="scanner-table align-middle">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Precio</th>
                      <th>Cantidad</th>
                      <th>Total</th>
                      <th>Origen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.key}>
                        <td>
                          <div className="scanner-product-cell">
                            {item.hasImage ? (
                              <img className="scanner-product-image" src={item.imageUrl} alt={item.name} loading="lazy" />
                            ) : (
                              <div className="scanner-product-fallback">IMG</div>
                            )}
                            <div>
                              <strong>{item.name}</strong>
                              <div className="table-subcopy">{item.category || 'Sin categoria'}</div>
                            </div>
                          </div>
                        </td>
                        <td>${item.price.toFixed(2)}</td>
                        <td>{item.quantity}</td>
                        <td>${item.total.toFixed(2)}</td>
                        <td>
                          <Badge bg={item.lastSource.includes('cache') ? 'success' : item.lastSource === 'manual' ? 'dark' : 'primary'}>
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

      <Modal show={manualOpen} onHide={() => setManualOpen(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Producto Manual</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Precio</Form.Label>
            <Form.Control
              ref={manualPriceRef}
              type="number"
              min="0"
              step="0.01"
              value={manualPrice}
              onChange={(event) => setManualPrice(event.target.value)}
              placeholder="Ingresá el precio"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setManualOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleManualConfirm}>Confirmar</Button>
        </Modal.Footer>
      </Modal>
    </section>
  );
}

export default ScannerPage;
