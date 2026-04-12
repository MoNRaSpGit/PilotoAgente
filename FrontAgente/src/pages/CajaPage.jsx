import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Button, Form, Modal } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  closeCashbox,
  fetchCashboxMovements,
  fetchCashboxRanking,
  fetchCashboxSummary,
  fetchScannerLiveState,
  openCashbox,
  registerCashboxPayment
} from '../services/api';
import { clearSession } from '../store/slices/authSlice';
import { clearAuthSession, getAuthToken } from '../utils/authSession';

import {
  formatClock,
  formatDateTime,
  formatLongDate,
  formatMovementAmount,
  formatShortDate,
  getScannerStatusBadge,
  metricValue,
  money,
  normalizeRankingItems,
  normalizeRecentMovements,
  todayDate,
  trendClass,
  trendLabel,
  yesterdayDate
} from './caja/cajaPage.utils';
import {
  createEmptyScannerLiveState,
  getMovementSummaryLabel,
  normalizeScannerLiveState,
  resolveMovementLimit,
  resolveRankingLimit
} from './caja/cajaPage.state';

function CajaPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const [dashboard, setDashboard] = useState(null);
  const [liveSales, setLiveSales] = useState([]);
  const [scannerLiveState, setScannerLiveState] = useState(() => createEmptyScannerLiveState());
  const [loading, setLoading] = useState(true);
  const [rankingItems, setRankingItems] = useState([]);
  const [rankingMode, setRankingMode] = useState('top5');
  const [rankingLoading, setRankingLoading] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');
  const [savingOpen, setSavingOpen] = useState(false);
  const [savingClose, setSavingClose] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    description: ''
  });
  const [historyNow, setHistoryNow] = useState(() => new Date());
  const [savingPayment, setSavingPayment] = useState(false);
  const [comparisonExpanded, setComparisonExpanded] = useState(false);
  const [expandedMovements, setExpandedMovements] = useState({});
  const [movementsMode, setMovementsMode] = useState('recent');
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const dashboardRef = useRef(null);
  const loadDashboardRef = useRef(null);
  const loadMovementsRef = useRef(null);
  const movementsModeRef = useRef('recent');
  const loadRankingRef = useRef(null);
  const rankingModeRef = useRef('top5');
  const latestDashboardRequestRef = useRef(0);

  useEffect(() => {
    dashboardRef.current = dashboard;
  }, [dashboard]);

  const handleSessionExpired = useCallback(() => {
    dispatch(clearSession());
    clearAuthSession();
    navigate('/login', { replace: true });
    toast.error('Sesion vencida, volve a ingresar');
  }, [dispatch, navigate]);

  const loadDashboard = useCallback(async (quiet = false, options = {}) => {
    const requestId = latestDashboardRequestRef.current + 1;
    latestDashboardRequestRef.current = requestId;

    try {
      if (!quiet) {
        setLoading(true);
      }

      const movementLimit = resolveMovementLimit(options.movementsMode);
      const resolvedRankingMode = options.rankingMode || rankingMode;
      const rankingLimit = resolveRankingLimit(resolvedRankingMode);
      const [data, liveState, movementData, rankingData] = await Promise.all([
        fetchCashboxSummary({
          date: todayDate(),
          compareTo: yesterdayDate(),
          forceRefresh: Boolean(options.forceRefresh)
        }),
        fetchScannerLiveState(),
        fetchCashboxMovements({
          date: todayDate(),
          limit: movementLimit
        }),
        fetchCashboxRanking({ limit: rankingLimit })
      ]);
      if (requestId !== latestDashboardRequestRef.current) {
        return;
      }

      setDashboard(data);
      setLiveSales(normalizeRecentMovements(movementData?.items));
      setRankingItems(normalizeRankingItems(rankingData?.items));
      setRankingMode(resolvedRankingMode);
      setScannerLiveState(normalizeScannerLiveState(liveState));
    } catch (error) {
      if (requestId !== latestDashboardRequestRef.current) {
        return;
      }

      if (error.status === 401) {
        handleSessionExpired();
        return;
      }

      if (!quiet) {
        toast.error(error.message);
      }
    } finally {
      if (requestId === latestDashboardRequestRef.current) {
        setLoading(false);
        setMovementsLoading(false);
        setRankingLoading(false);
      }
    }
  }, [handleSessionExpired, rankingMode]);

  useEffect(() => {
    loadDashboardRef.current = loadDashboard;
  }, [loadDashboard]);

  const loadMovements = useCallback(async (mode = movementsMode, quiet = false) => {
    const movementLimit = resolveMovementLimit(mode);

    try {
      if (!quiet) {
        setMovementsLoading(true);
      }

      const movementData = await fetchCashboxMovements({
        date: todayDate(),
        limit: movementLimit
      });
      setLiveSales(normalizeRecentMovements(movementData?.items));
      setMovementsMode(mode);
    } catch (error) {
      if (!quiet) {
        toast.error(error.message);
      }
    } finally {
      if (!quiet) {
        setMovementsLoading(false);
      }
    }
  }, [movementsMode]);

  useEffect(() => {
    loadMovementsRef.current = loadMovements;
  }, [loadMovements]);

  const loadRanking = useCallback(async (mode = rankingMode, quiet = false) => {
    const rankingLimit = resolveRankingLimit(mode);

    try {
      if (!quiet) {
        setRankingLoading(true);
      }

      const rankingData = await fetchCashboxRanking({ limit: rankingLimit });
      setRankingItems(normalizeRankingItems(rankingData?.items));
      setRankingMode(mode);
    } catch (error) {
      if (!quiet) {
        toast.error(error.message);
      }
    } finally {
      if (!quiet) {
        setRankingLoading(false);
      }
    }
  }, [rankingMode]);

  useEffect(() => {
    loadRankingRef.current = loadRanking;
  }, [loadRanking]);

  useEffect(() => {
    movementsModeRef.current = movementsMode;
  }, [movementsMode]);

  useEffect(() => {
    rankingModeRef.current = rankingMode;
  }, [rankingMode]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setHistoryNow(new Date());
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const run = async () => {
      const requestId = latestDashboardRequestRef.current + 1;
      latestDashboardRequestRef.current = requestId;

      try {
        setLoading(true);
        const currentMovementsMode = movementsModeRef.current;
        const currentRankingMode = rankingModeRef.current;
        const movementLimit = resolveMovementLimit(currentMovementsMode);
        const rankingLimit = resolveRankingLimit(currentRankingMode);
        const [data, liveState, movementData, rankingData] = await Promise.all([
          fetchCashboxSummary({
            date: todayDate(),
            compareTo: yesterdayDate()
          }),
          fetchScannerLiveState(),
          fetchCashboxMovements({
            date: todayDate(),
            limit: movementLimit
          }),
          fetchCashboxRanking({ limit: rankingLimit })
        ]);
        if (!active || requestId !== latestDashboardRequestRef.current) {
          return;
        }

        setDashboard(data);
        setLiveSales(normalizeRecentMovements(movementData?.items));
        setRankingItems(normalizeRankingItems(rankingData?.items));
        setScannerLiveState(normalizeScannerLiveState(liveState));
      } catch (error) {
        if (!active || requestId !== latestDashboardRequestRef.current) {
          return;
        }

        if (error.status === 401) {
          handleSessionExpired();
          return;
        }

        toast.error(error.message);
      } finally {
        if (active && requestId === latestDashboardRequestRef.current) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      active = false;
    };
  }, [handleSessionExpired]);

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
        if (payload?.operator?.role !== 'operario') {
          return;
        }

        setScannerLiveState(normalizeScannerLiveState({
          ...payload,
          updated_at: payload.updated_at || new Date().toISOString()
        }));
        return;
      }

      if (payload.type === 'sale') {
        if (loadMovementsRef.current) {
          loadMovementsRef.current(movementsModeRef.current, true);
        }
        if (loadRankingRef.current) {
          loadRankingRef.current(rankingModeRef.current, true);
        }
      } else if (payload.type === 'cashbox:opened' || payload.type === 'cashbox:closed') {
        setLiveSales([]);
        setRankingItems([]);
        setScannerLiveState(createEmptyScannerLiveState());
      }

      if (loadDashboardRef.current && payload.type !== 'scanner:state') {
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
  const scannerStatusBadge = getScannerStatusBadge(
    scannerLiveState.updated_at,
    scannerLiveState.items.length > 0,
    historyNow
  );

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

  const movementSummaryLabel = getMovementSummaryLabel(movementsMode);

  const toggleMovementDetails = (movementId) => {
    setExpandedMovements((current) => ({
      ...current,
      [movementId]: !current[movementId]
    }));
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
      setRankingItems([]);
      setScannerLiveState(createEmptyScannerLiveState());
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
      setRankingItems([]);
      setScannerLiveState(createEmptyScannerLiveState());
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
        <div className="caja-hero-copy">
          <p className="eyebrow">Caja</p>
          <h1>Control en vivo</h1>
          <p className="caja-hero-subtitle">
            {formatLongDate()} · seguimiento fino de caja, scanner y movimientos.
          </p>
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
            <article className="card-panel caja-stat-card caja-metric-card caja-metric-card-soft">
              <span>Caja inicial</span>
              <strong>{money(selectedDay.opening_amount)}</strong>
            </article>
            <article className="card-panel caja-stat-card caja-metric-card caja-metric-card-accent">
              <span>Ventas del dia</span>
              <strong>{money(selectedDay.sales_total)}</strong>
            </article>
            <article className="card-panel caja-stat-card caja-metric-card caja-metric-card-profit">
              <span>Ganancia diaria</span>
              <strong>{money(selectedDay.profit_amount)}</strong>
            </article>
            <article className="card-panel caja-stat-card caja-metric-card caja-metric-card-soft">
              <span>Monto actual</span>
              <strong>{money(selectedDay.current_amount)}</strong>
            </article>
            <article className="card-panel caja-stat-card caja-metric-card caja-metric-card-soft">
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
                  <span className={`caja-trend-arrow ${comparisonExpanded ? 'is-open' : ''}`}>v</span>
                </button>
              </div>
            </article>
          </div>

          <div className="caja-bottom-grid">
            <div className="caja-left-stack">
              <article className="card-panel caja-live-panel">
                <div className="panel-heading">
                  <div className="caja-panel-copy">
                    <h3>Caja en vivo</h3>
                    <p>Espejo en tiempo real de lo que arma el operario en el scanner.</p>
                  </div>
                <Badge
                  className={`caja-panel-status-badge ${scannerStatusBadge.tone === 'active' ? 'is-active' : ''}`}
                  bg={scannerStatusBadge.bg}
                  text={scannerStatusBadge.text}
                >
                  {scannerStatusBadge.label}
                </Badge>
              </div>

                {scannerLiveState.editing ? (
                  <div className="caja-live-editing-banner">
                    <span>Editando producto</span>
                    <strong>
                      {scannerLiveState.editing.name || 'Producto'} · $
                      {Number(scannerLiveState.editing.price || 0).toFixed(2)}
                    </strong>
                  </div>
                ) : null}
                {scannerLiveState.manual ? (
                  <div className="caja-live-manual-banner">
                    <span>Producto manual</span>
                    <strong>El operario esta cargando un producto manualmente.</strong>
                    <p>La caja lo ve en vivo mientras el modal sigue abierto.</p>
                  </div>
                ) : null}
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
                  <div className="caja-panel-copy">
                    <h3>Movimientos</h3>
                    <p>Resumen compacto de ventas y pagos confirmados.</p>
                  </div>
                  <div className="caja-movements-tools">
                    <div className="caja-movements-actions">
                      {movementsMode === 'recent' ? (
                        <button type="button" className="caja-inline-link" onClick={() => loadMovements('top10')} disabled={movementsLoading}>
                          Ver mas
                        </button>
                      ) : null}
                      {movementsMode === 'top10' ? (
                        <button type="button" className="caja-inline-link" onClick={() => loadMovements('all')} disabled={movementsLoading}>
                          Ver todo
                        </button>
                      ) : null}
                      {movementsMode === 'all' ? (
                        <button type="button" className="caja-inline-link" onClick={() => loadMovements('recent')} disabled={movementsLoading}>
                          Volver a 3
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
                <small className="caja-movements-caption">{movementSummaryLabel}</small>

                {liveSales.length === 0 ? (
                  <div className="caja-live-empty">
                    <strong>Sin movimientos recientes</strong>
                    <p>Cuando haya ventas confirmadas, este resumen acompaña el panel de caja en vivo.</p>
                  </div>
                ) : (
                  <div className="caja-movements-list">
                    {liveSales.map((sale) => (
                      <div className="caja-movement-row" key={`movement-${sale.id}`}>
                        <div className="caja-movement-head">
                          <div>
                            {sale.type === 'payment' ? (
                              <>
                                <strong className="caja-movement-kind">Pago</strong>
                                <span className="caja-movement-meta">{`${sale.operatorName} · ${formatDateTime(sale.createdAt)}`}</span>
                                <p className="caja-movement-description is-highlighted">
                                  {sale.description || 'Pago registrado'}
                                </p>
                              </>
                            ) : (
                              <>
                                <strong className="caja-movement-kind is-sale">Venta</strong>
                                <span className="caja-movement-meta">{`${sale.operatorName} Â· ${formatDateTime(sale.createdAt)}`}</span>
                                <p className="caja-movement-description is-highlighted is-sale">
                                  {sale.description || 'Venta desde escaner'}
                                </p>
                              </>
                            )}
                          </div>
                          <div className="caja-live-sale-head-actions">
                            <strong className={`caja-movement-amount ${sale.type === 'payment' ? 'is-payment' : 'is-sale'}`}>
                              {formatMovementAmount(sale.amount, sale.type)}
                            </strong>
                            {sale.items.length > 0 ? (
                              <button
                                type="button"
                                className="caja-live-sale-toggle"
                                onClick={() => toggleMovementDetails(sale.id)}
                                aria-expanded={Boolean(expandedMovements[sale.id])}
                                aria-label={expandedMovements[sale.id] ? 'Ocultar detalle' : 'Ver detalle'}
                              >
                                <span
                                  className={`caja-live-sale-toggle-icon ${
                                    expandedMovements[sale.id] ? 'is-open' : ''
                                  }`}
                                >
                                  {expandedMovements[sale.id] ? '-' : '+'}
                                </span>
                                <span className="caja-live-sale-toggle-label">
                                  {expandedMovements[sale.id] ? 'Ocultar' : 'Detalle'}
                                </span>
                              </button>
                            ) : null}
                          </div>
                        </div>

                        {sale.items.length > 0 ? (
                          <div
                            className={`caja-live-sale-items ${
                              expandedMovements[sale.id] ? 'is-open' : ''
                            }`}
                          >
                            {sale.items.map((item, index) => (
                              <div
                                className="caja-live-sale-item-row"
                                key={`${sale.id}-${item.barcode || item.name || 'item'}-${index}`}
                              >
                                <span className="caja-live-sale-item-name">
                                  {item.quantity} x {item.name}
                                </span>
                                <span className="caja-live-sale-item-total">{money(item.total)}</span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </article>

            </div>

            <div className="caja-right-stack">
              <article className="card-panel caja-live-panel caja-ranking-panel">
                <div className="panel-heading">
                  <div className="caja-panel-copy">
                    <h3>Ranking</h3>
                    <p>Ranking del {formatShortDate(new Date())}</p>
                  </div>
                  <div className="caja-movements-tools">
                    <div className="caja-movements-actions">
                      {rankingMode === 'top5' ? (
                        <button type="button" className="caja-inline-link" onClick={() => loadRanking('top10')} disabled={rankingLoading}>
                          Ver mas
                        </button>
                      ) : null}
                      {rankingMode === 'top10' ? (
                        <button type="button" className="caja-inline-link" onClick={() => loadRanking('all')} disabled={rankingLoading}>
                          Ver todo
                        </button>
                      ) : null}
                      {rankingMode === 'all' ? (
                        <button type="button" className="caja-inline-link" onClick={() => loadRanking('top5')} disabled={rankingLoading}>
                          Volver a 5
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                {rankingItems.length === 0 ? (
                  <div className="caja-live-empty">
                    <strong>Sin ranking disponible</strong>
                    <p>El ranking aparece cuando se registran ventas con productos.</p>
                  </div>
                ) : (
                  <div className="caja-ranking-list">
                    {rankingItems.map((item) => (
                      <div className="caja-ranking-row" key={`${item.rank}-${item.productName}-${item.barcode || 'sin-codigo'}`}>
                        <div className="caja-ranking-main">
                          <div className="caja-ranking-product">
                            {item.hasImage ? (
                              <img className="caja-ranking-image" src={item.imageUrl} alt={item.productName} loading="lazy" />
                            ) : (
                              <span className="caja-ranking-image-fallback">IMG</span>
                            )}
                            <div className="caja-ranking-product-copy">
                              <strong>{item.productName}</strong>
                              <small className="caja-ranking-barcode">COD: {item.barcode || 'sin-codigo'}</small>
                            </div>
                          </div>
                        </div>
                        <span className="caja-ranking-sales">{item.totalQuantity}</span>
                      </div>
                    ))}
                  </div>
                )}
              </article>

              <article className="card-panel caja-payment-panel caja-payment-panel-compact">
                <div className="panel-heading">
                  <div className="caja-panel-copy">
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
                  <Button type="submit" variant="dark" className="caja-payment-submit" disabled={savingPayment || !isOpen}>
                    {savingPayment ? 'Guardando...' : 'Agregar pago'}
                  </Button>
                </form>

                <div className="caja-close-box">
                  <Button variant="dark" onClick={openCloseConfirmModal} disabled={savingClose}>
                    {savingClose ? 'Cerrando...' : 'Cerrar caja'}
                  </Button>
                </div>
              </article>
            </div>
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
            <strong>Queres cerrar la caja?</strong>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={closeCloseConfirmModal} disabled={savingClose}>
            Cancelar
          </Button>
          <Button
            variant="dark"
            onClick={async () => {
              closeCloseConfirmModal();
              await handleCloseCashbox();
            }}
            disabled={savingClose}
          >
            {savingClose ? 'Cerrando...' : 'Cerrar caja'}
          </Button>
        </Modal.Footer>
      </Modal>
    </section>
  );
}

export default CajaPage;







