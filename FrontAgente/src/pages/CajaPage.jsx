import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Form, Modal } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { closeCashbox, fetchCashboxSummary, openCashbox, registerCashboxPayment } from '../services/api';
import { clearSession } from '../store/slices/authSlice';
import { clearAuthSession, getAuthToken } from '../utils/authSession';

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function trendClass(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'is-neutral';
  }

  const next = Number(value);

  if (next > 0) {
    return 'is-positive';
  }

  if (next < 0) {
    return 'is-negative';
  }

  return 'is-neutral';
}

function trendLabel(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'Sin referencia';
  }

  const next = Number(value);
  const sign = next > 0 ? '+' : '';
  return `${sign}${next.toFixed(2)}%`;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayDate() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

function metricValue(current, previous) {
  return `${money(current)} · ${money(previous)}`;
}

function formatClock(value) {
  if (!value) {
    return 'Ahora';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Ahora';
  }

  return date.toLocaleTimeString('es-UY', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function normalizeLiveSale(payload) {
  const items = Array.isArray(payload?.items)
    ? payload.items.map((item) => ({
        barcode: item.barcode || null,
        name: item.product_name || item.name || 'Producto',
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.unit_price || item.price || 0),
        total: Number(item.total || 0)
      }))
    : [];

  return {
    id: payload?.movement_id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    amount: Number(payload?.amount || 0),
    description: payload?.description || 'Venta desde escaner',
    source: payload?.source || 'scanner',
    operatorName: payload?.operator?.name || payload?.operator_name || 'Operario',
    operatorRole: payload?.operator?.role || payload?.operator_role || null,
    items,
    createdAt: new Date().toISOString()
  };
}

function formatSaleAmount(value) {
  return `+ ${money(value)}`;
}

function CajaPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const [dashboard, setDashboard] = useState(null);
  const [liveSales, setLiveSales] = useState([]);
  const [scannerLiveState, setScannerLiveState] = useState({
    items: [],
    total: 0,
    state: 'idle',
    operator: null,
    updated_at: null
  });
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');
  const [savingOpen, setSavingOpen] = useState(false);
  const [savingClose, setSavingClose] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    description: ''
  });
  const [savingPayment, setSavingPayment] = useState(false);
  const [comparisonExpanded, setComparisonExpanded] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const dashboardRef = useRef(null);
  const loadDashboardRef = useRef(null);

  useEffect(() => {
    dashboardRef.current = dashboard;
  }, [dashboard]);

  const handleSessionExpired = () => {
    dispatch(clearSession());
    clearAuthSession();
    navigate('/login', { replace: true });
    toast.error('Sesion vencida, volve a ingresar');
  };

  const loadDashboard = async (quiet = false, options = {}) => {
    try {
      if (!quiet) {
        setLoading(true);
      }

      const data = await fetchCashboxSummary({
        date: todayDate(),
        compareTo: yesterdayDate(),
        forceRefresh: Boolean(options.forceRefresh)
      });

      setDashboard(data);
    } catch (error) {
      if (error.status === 401) {
        handleSessionExpired();
        return;
      }

      if (!quiet) {
        toast.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardRef.current = loadDashboard;
  }, [loadDashboard]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        setLoading(true);
        const data = await fetchCashboxSummary({
          date: todayDate(),
          compareTo: yesterdayDate()
        });

        if (active) {
          setDashboard(data);
        }
      } catch (error) {
        if (error.status === 401) {
          handleSessionExpired();
          return;
        }

        if (active) {
          toast.error(error.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const token = getAuthToken();

    if (!token) {
      return undefined;
    }

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    const eventSource = new EventSource(`${apiUrl}/api/caja/stream?token=${encodeURIComponent(token)}`);

    const handleCashboxUpdate = (event) => {
      let payload = {};

      try {
        payload = event?.data ? JSON.parse(event.data) : {};
      } catch (_error) {
        payload = {};
      }

      if (payload.type === 'scanner:state') {
        setScannerLiveState({
          items: Array.isArray(payload.items) ? payload.items : [],
          total: Number(payload.total || 0),
          state: payload.state || 'idle',
          operator: payload.operator || null,
          updated_at: payload.updated_at || new Date().toISOString()
        });
      } else if (payload.type === 'sale') {
        const liveSale = normalizeLiveSale(payload);
        setLiveSales((current) => [liveSale, ...current].slice(0, 6));
      } else if (payload.type === 'open' || payload.type === 'close') {
        setLiveSales([]);
        setScannerLiveState({
          items: [],
          total: 0,
          state: 'idle',
          operator: null,
          updated_at: null
        });
      }

      if (loadDashboardRef.current) {
        loadDashboardRef.current(true, { forceRefresh: true });
      }
    };

    eventSource.addEventListener('cashbox:update', handleCashboxUpdate);

    return () => {
      eventSource.removeEventListener('cashbox:update', handleCashboxUpdate);
      eventSource.close();
    };
  }, []);

  const isOpen = Boolean(dashboard?.is_open);
  const openCashboxInfo = dashboard?.open_cashbox || null;
  const selectedDay = dashboard?.selected_day || {
    opening_amount: 0,
    sales_total: 0,
    payments_total: 0,
    profit_amount: 0,
    current_amount: 0
  };
  const compareDay = dashboard?.previous_day || {
    sales_total: 0
  };
  const weeklySummary = dashboard?.weekly || {
    current: { sales_total: 0 },
    previous: { sales_total: 0 },
    comparison_percent: null
  };
  const monthlySummary = dashboard?.monthly || {
    current: { sales_total: 0 },
    previous: { sales_total: 0 },
    comparison_percent: null
  };

  const closeOpenModal = () => {
    setOpenModal(false);
    setOpeningAmount('');
  };

  const openCloseConfirmModal = () => {
    setCloseConfirmOpen(true);
  };

  const closeCloseConfirmModal = () => {
    setCloseConfirmOpen(false);
  };

  const handleOpenCashbox = async () => {
    const amount = Number.parseFloat(openingAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Ingresa un monto inicial valido');
      return;
    }

    try {
      setSavingOpen(true);
      const openedCashbox = await openCashbox({ opening_amount: amount });
      setDashboard((current) => ({
        ...(current || {}),
        is_open: true,
        open_cashbox: openedCashbox,
        selected_day: {
          ...(current?.selected_day || {}),
          opening_amount: openedCashbox.opening_amount,
          sales_total: openedCashbox.sales_total,
          payments_total: openedCashbox.payments_total,
          current_amount: openedCashbox.current_amount
        }
      }));
      setLiveSales([]);
      setScannerLiveState({
        items: [],
        total: 0,
        state: 'idle',
        operator: null,
        updated_at: null
      });
      toast.success('Caja abierta');
      closeOpenModal();
    } catch (error) {
      if (error.status === 401) {
        handleSessionExpired();
        return;
      }

      if (error.status === 409 && error.data?.item) {
        setDashboard((current) => ({
          ...(current || {}),
          is_open: true,
          open_cashbox: error.data.item
        }));
      } else {
        toast.error(error.message);
      }
    } finally {
      setSavingOpen(false);
    }
  };

  const handleCloseCashbox = async () => {
    try {
      setSavingClose(true);
      await closeCashbox();
      setDashboard((current) => ({
        ...(current || {}),
        is_open: false,
        open_cashbox: null,
        selected_day: {
          ...(current?.selected_day || {}),
          opening_amount: 0,
          sales_total: 0,
          payments_total: 0,
          current_amount: 0,
          profit_amount: 0
        }
      }));
      setComparisonExpanded(false);
      setLiveSales([]);
      setScannerLiveState({
        items: [],
        total: 0,
        state: 'idle',
        operator: null,
        updated_at: null
      });
      toast.success('Caja cerrada');
    } catch (error) {
      if (error.status === 401) {
        handleSessionExpired();
        return;
      }

      toast.error(error.message);
    } finally {
      setSavingClose(false);
    }
  };

  const handlePaymentSubmit = async (event) => {
    event.preventDefault();

    const amount = Number.parseFloat(paymentForm.amount);
    const description = paymentForm.description.trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Ingresa un monto valido');
      return;
    }

    try {
      setSavingPayment(true);
      const updatedCashbox = await registerCashboxPayment({
        amount,
        description
      });

      setDashboard((current) => ({
        ...(current || {}),
        open_cashbox: updatedCashbox,
        selected_day: {
          ...(current?.selected_day || {}),
          opening_amount: updatedCashbox.opening_amount,
          sales_total: updatedCashbox.sales_total,
          payments_total: updatedCashbox.payments_total,
          current_amount: updatedCashbox.current_amount,
          profit_amount: Number(
            ((Number(updatedCashbox.sales_total || 0) - Number(updatedCashbox.payments_total || 0)) * 0.2).toFixed(2)
          )
        }
      }));
      setPaymentForm({
        amount: '',
        description: ''
      });
      toast.success('Pago registrado');
    } catch (error) {
      if (error.status === 401) {
        handleSessionExpired();
        return;
      }

      toast.error(error.message);
    } finally {
      setSavingPayment(false);
    }
  };

  return (
    <section className="page-section caja-page">
      <div className="hero-panel caja-hero caja-hero-minimal">
        <div>
          <p className="eyebrow">Caja</p>
          <h1>Control en vivo</h1>
        </div>
        <div className="caja-hero-status">
          <Badge bg={isOpen ? 'success' : 'secondary'}>{isOpen ? 'Abierta' : 'Cerrada'}</Badge>
          {isOpen && openCashboxInfo ? <span>{openCashboxInfo.opened_by_name}</span> : <span>Lista para abrir</span>}
        </div>
      </div>

      {!loading && !isOpen ? (
        <div className="card-panel caja-empty-state">
          <h2>La caja del dia no esta abierta</h2>
          <Button variant="dark" onClick={() => setOpenModal(true)}>
            Abrir caja
          </Button>
        </div>
      ) : null}

      {isOpen ? (
        <>
          <div className="caja-section-label">
            <p className="eyebrow">Seccion Caja</p>
          </div>

          <div className="caja-grid">
            <article className="card-panel caja-stat-card caja-metric-card">
              <span>Caja inicial</span>
              <strong>{money(selectedDay.opening_amount)}</strong>
            </article>
            <article className="card-panel caja-stat-card caja-metric-card">
              <span>Ventas del dia</span>
              <strong>{money(selectedDay.sales_total)}</strong>
            </article>
            <article className="card-panel caja-stat-card caja-metric-card">
              <span>Ganancia diaria</span>
              <strong>{money(selectedDay.profit_amount)}</strong>
            </article>
            <article className="card-panel caja-stat-card caja-metric-card caja-metric-card-accent">
              <span>Monto actual</span>
              <strong>{money(selectedDay.current_amount)}</strong>
            </article>
            <article className="card-panel caja-stat-card caja-metric-card">
              <span>Pagos registrados</span>
              <strong>{money(selectedDay.payments_total)}</strong>
            </article>
            <article className={`card-panel caja-trend-card caja-trend-card-compact ${comparisonExpanded ? 'is-expanded' : ''}`}>
              <span>Comparaciones</span>
              <div className="caja-trend-list">
                <div className="caja-trend-item caja-trend-item-main">
                  <small>Hoy vs ayer</small>
                  <strong className={trendClass(dashboard?.comparison_percent)}>{trendLabel(dashboard?.comparison_percent)}</strong>
                  <p>{metricValue(selectedDay.sales_total, compareDay.sales_total)}</p>
                </div>
                <div className={`caja-trend-flyout ${comparisonExpanded ? 'is-open' : ''}`}>
                  <div className="caja-trend-item caja-trend-item-compact">
                    <small>Semana pasada</small>
                    <strong className={trendClass(weeklySummary.comparison_percent)}>{trendLabel(weeklySummary.comparison_percent)}</strong>
                    <p>{metricValue(weeklySummary.current.sales_total, weeklySummary.previous.sales_total)}</p>
                  </div>
                  <div className="caja-trend-item caja-trend-item-compact">
                    <small>Mes pasado</small>
                    <strong className={trendClass(monthlySummary.comparison_percent)}>{trendLabel(monthlySummary.comparison_percent)}</strong>
                    <p>{metricValue(monthlySummary.current.sales_total, monthlySummary.previous.sales_total)}</p>
                  </div>
                </div>
              </div>
              <div className="caja-trend-footer">
                <span className="caja-trend-footer-label">{comparisonExpanded ? 'Ocultar detalle' : 'Ver semana y mes'}</span>
                <button
                  type="button"
                  className="caja-trend-toggle"
                  onClick={() => setComparisonExpanded((current) => !current)}
                  aria-expanded={comparisonExpanded}
                  aria-label={comparisonExpanded ? 'Contraer comparaciones' : 'Expandir comparaciones'}
                >
                  <span className={`caja-trend-arrow ${comparisonExpanded ? 'is-open' : ''}`}>⌄</span>
                </button>
              </div>
            </article>
          </div>

          <div className="caja-bottom-grid">
            <div className="caja-left-stack">
              <article className="card-panel caja-live-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Caja en vivo</h3>
                    <p>Espejo en tiempo real de lo que arma el operario en el scanner.</p>
                  </div>
                  <Badge bg={scannerLiveState.items.length > 0 ? 'success' : 'secondary'}>
                    {scannerLiveState.items.length > 0 ? 'Activo' : 'Sin escaneo'}
                  </Badge>
                </div>

                {scannerLiveState.items.length === 0 ? (
                  <div className="caja-live-empty">
                    <strong>Sin productos escaneados todavia</strong>
                    <p>Cuando el operario agregue o quite productos, la caja se va a clonar aca al instante.</p>
                  </div>
                ) : (
                  <div className="caja-live-feed">
                    <div className="caja-live-scanner-head">
                      <div>
                        <strong>{scannerLiveState.operator?.name || 'Operario'}</strong>
                        <span>{formatClock(scannerLiveState.updated_at)}</span>
                      </div>
                      <div className="caja-live-scanner-total">
                        <small>Total actual</small>
                        <strong>{money(scannerLiveState.total)}</strong>
                      </div>
                    </div>

                    {scannerLiveState.items.map((item, index) => (
                      <div className="caja-live-sale-item-row caja-live-scanner-row" key={`${item.barcode || item.name || 'item'}-${index}`}>
                        <span className="caja-live-sale-item-name">
                          {item.quantity} x {item.name}
                        </span>
                        <span className="caja-live-sale-item-total">{money(item.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </article>

              <article className="card-panel caja-live-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Movimientos</h3>
                    <p>Resumen compacto de las ventas confirmadas.</p>
                  </div>
                  <Badge bg="secondary">Historial</Badge>
                </div>

                {liveSales.length === 0 ? (
                  <div className="caja-live-empty">
                    <strong>Sin movimientos recientes</strong>
                    <p>Cuando haya ventas confirmadas, este resumen acompaña el panel de caja en vivo.</p>
                  </div>
                ) : (
                  <div className="caja-movements-list">
                    {liveSales.map((sale) => (
                      <div className="caja-movement-row" key={`movement-${sale.id}`}>
                        <div>
                          <strong>{sale.operatorName}</strong>
                          <span>{formatClock(sale.createdAt)}</span>
                        </div>
                        <strong className="caja-movement-amount">{formatSaleAmount(sale.amount)}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            </div>

            <article className="card-panel caja-payment-panel caja-payment-panel-compact caja-payment-side">
              <div className="panel-heading">
                <div>
                  <h3>Registrar pago</h3>
                  <p>Movimientos manuales, en formato liviano.</p>
                </div>
              </div>

              <form className="caja-payment-form caja-payment-form-compact" onSubmit={handlePaymentSubmit}>
                <input
                  className="form-control"
                  type="text"
                  inputMode="decimal"
                  pattern="\d*\.?\d*"
                  placeholder="Monto"
                  value={paymentForm.amount}
                  onChange={(event) => {
                    const nextValue = event.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
                    setPaymentForm((current) => ({
                      ...current,
                      amount: nextValue
                    }));
                  }}
                />
                <input
                  className="form-control"
                  type="text"
                  placeholder="Descripcion"
                  value={paymentForm.description}
                  onChange={(event) => {
                    setPaymentForm((current) => ({
                      ...current,
                      description: event.target.value
                    }));
                  }}
                />
                <Button type="submit" variant="dark" disabled={savingPayment || !isOpen}>
                  {savingPayment ? 'Guardando...' : 'Agregar pago'}
                </Button>
              </form>

              <div className="caja-close-box">
                <div className="caja-close-box-copy">
                  <span>Acción sensible</span>
                  <small>Cerrar caja requiere confirmación.</small>
                </div>
                <Button variant="danger" onClick={openCloseConfirmModal} disabled={savingClose}>
                  {savingClose ? 'Cerrando...' : 'Cerrar caja'}
                </Button>
              </div>
            </article>
          </div>
        </>
      ) : null}

      <Modal show={openModal} onHide={closeOpenModal} centered restoreFocus={false}>
        <Modal.Header closeButton>
          <Modal.Title>Abrir caja</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Control
            type="text"
            inputMode="decimal"
            pattern="\d*\.?\d*"
            placeholder="Monto inicial"
            value={openingAmount}
            onChange={(event) => {
              const nextValue = event.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
              setOpeningAmount(nextValue);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleOpenCashbox();
              }
            }}
          />
          {user ? (
            <div className="caja-open-meta">
              <span>{user.name}</span>
              <small>{user.role}</small>
            </div>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={closeOpenModal}>
            Cancelar
          </Button>
          <Button variant="dark" onClick={handleOpenCashbox} disabled={savingOpen}>
            {savingOpen ? 'Abriendo...' : 'Abrir'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={closeConfirmOpen} onHide={closeCloseConfirmModal} centered restoreFocus={false}>
        <Modal.Header closeButton>
          <Modal.Title>Confirmar cierre</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="caja-close-confirm">
            <strong>Querés cerrar la caja?</strong>
            <p>Esta acción termina la caja abierta y bloquea nuevos movimientos hasta que se abra otra.</p>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={closeCloseConfirmModal} disabled={savingClose}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              closeCloseConfirmModal();
              await handleCloseCashbox();
            }}
            disabled={savingClose}
          >
            {savingClose ? 'Cerrando...' : 'Sí, cerrar caja'}
          </Button>
        </Modal.Footer>
      </Modal>
    </section>
  );
}

export default CajaPage;
