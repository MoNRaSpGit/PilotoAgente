import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Form, Modal } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  closeCashbox,
  fetchCashboxSummary,
  fetchExpensesSummary,
  openCashbox,
  registerCashboxPayment
} from '../services/api';
import { clearSession } from '../store/slices/authSlice';
import { clearAuthSession } from '../utils/authSession';
import { getAuthToken } from '../utils/authSession';

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

function CajaPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const [dashboard, setDashboard] = useState(null);
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

      let expensesSummary = dashboardRef.current?.expenses_summary || null;

      if (!quiet || !expensesSummary) {
        expensesSummary = await fetchExpensesSummary();
      }

      setDashboard({
        ...data,
        expenses_summary: expensesSummary
      });
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
        const [data, expensesSummary] = await Promise.all([
          fetchCashboxSummary({
            date: todayDate(),
            compareTo: yesterdayDate()
          }),
          fetchExpensesSummary()
        ]);

        if (active) {
          setDashboard({
            ...data,
            expenses_summary: expensesSummary
          });
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
    const handleCashboxUpdate = () => {
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
  const expenseTotals = dashboard?.expenses_summary?.totals || {
    daily_total: 0,
    monthly_total: 0,
    business_daily_total: 0,
    business_monthly_total: 0,
    home_daily_total: 0,
    home_monthly_total: 0
  };
  const businessBaseResult = Number(
    (
      Number(selectedDay.sales_total || 0) -
      Number(selectedDay.payments_total || 0) -
      Number(expenseTotals.business_daily_total || 0)
    ).toFixed(2)
  );
  const estimatedBusinessProfit = Number((businessBaseResult * 0.22).toFixed(2));

  const closeOpenModal = () => {
    setOpenModal(false);
    setOpeningAmount('');
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
          current_amount: 0
        }
      }));
      setComparisonExpanded(false);
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
          current_amount: updatedCashbox.current_amount
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
          <span>Ganancia diaria negocio</span>
          <strong>{money(estimatedBusinessProfit)}</strong>
        </article>
        <article className="card-panel caja-stat-card caja-metric-card caja-metric-card-accent">
          <span>Monto Actual</span>
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
              <strong className={trendClass(dashboard?.comparison_percent)}>
                {trendLabel(dashboard?.comparison_percent)}
              </strong>
              <p>{metricValue(selectedDay.sales_total, compareDay.sales_total)}</p>
            </div>
            <div className={`caja-trend-flyout ${comparisonExpanded ? 'is-open' : ''}`}>
              <div className="caja-trend-item caja-trend-item-compact">
                <small>Semana pasada</small>
                <strong className={trendClass(weeklySummary.comparison_percent)}>
                  {trendLabel(weeklySummary.comparison_percent)}
                </strong>
                <p>{metricValue(weeklySummary.current.sales_total, weeklySummary.previous.sales_total)}</p>
              </div>
              <div className="caja-trend-item caja-trend-item-compact">
                <small>Mes pasado</small>
                <strong className={trendClass(monthlySummary.comparison_percent)}>
                  {trendLabel(monthlySummary.comparison_percent)}
                </strong>
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

      <div className="card-panel caja-expenses-panel">
        <div className="panel-heading">
          <div>
            <h3>Gastos estimados</h3>
            <p>Base diaria de negocio y hogar tomada desde la configuración editable.</p>
          </div>
        </div>
        <div className="caja-expenses-summary">
          <article>
            <span>Gastos negocio</span>
            <strong>{money(expenseTotals.business_daily_total)}</strong>
          </article>
          <article>
            <span>Ventas del dia</span>
            <strong>{money(selectedDay.sales_total)}</strong>
          </article>
          <article className="caja-expense-highlight">
            <span>Resultado negocio</span>
            <strong>{money(estimatedBusinessProfit)}</strong>
          </article>
        </div>
      </div>

      <div className="card-panel caja-payment-panel caja-payment-panel-compact">
        <div className="panel-heading">
          <div>
            <h3>Registrar pago</h3>
          </div>
        </div>

        <form className="caja-payment-form" onSubmit={handlePaymentSubmit}>
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
      </div>

      <div className="caja-actions-inline">
        <Button variant="outline-dark" onClick={handleCloseCashbox} disabled={savingClose}>
          {savingClose ? 'Cerrando...' : 'Cerrar caja'}
        </Button>
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
    </section>
  );
}

export default CajaPage;
