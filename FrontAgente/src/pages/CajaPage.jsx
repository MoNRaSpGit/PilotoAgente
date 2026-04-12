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

const BUSINESS_TIMEZONE = 'America/Montevideo';
const DATE_DEBUG = true;
const parsedDateDebugSeen = new Set();
let emptyDateDebugLogged = false;

function logDateDebug(label, payload) {
  if (!DATE_DEBUG || typeof window === 'undefined') {
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`[TZ_DEBUG][Caja] ${label}`, payload);
}

function getBusinessDateParts(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    return null;
  }

  return { year, month, day };
}

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
  const parts = getBusinessDateParts(new Date());

  if (!parts) {
    return new Date().toISOString().slice(0, 10);
  }

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function yesterdayDate() {
  const today = todayDate();
  const baseDate = new Date(`${today}T00:00:00`);
  baseDate.setDate(baseDate.getDate() - 1);
  const parts = getBusinessDateParts(baseDate);

  if (!parts) {
    return baseDate.toISOString().slice(0, 10);
  }

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatShortDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return todayDate();
  }

  return date.toLocaleDateString('es-UY', {
    timeZone: BUSINESS_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function metricValue(current, previous) {
  return `${money(current)} · ${money(previous)}`;
}

function formatLongDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Hoy';
  }

  return date.toLocaleDateString('es-UY', {
    timeZone: BUSINESS_TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
}

function parseApiDate(value) {
  if (!value) {
    if (!emptyDateDebugLogged) {
      emptyDateDebugLogged = true;
      logDateDebug('parseApiDate:empty', { value });
    }
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const raw = String(value).trim();

  if (!raw) {
    logDateDebug('parseApiDate:blank', { value });
    return null;
  }

  const hasTimezone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(raw);
  const normalized = raw.includes(' ') ? raw.replace(' ', 'T') : raw;
  const iso = hasTimezone ? normalized : `${normalized}Z`;
  const parsed = new Date(iso);
  const isValid = !Number.isNaN(parsed.getTime());

  if (!parsedDateDebugSeen.has(raw)) {
    parsedDateDebugSeen.add(raw);
    logDateDebug('parseApiDate', {
      raw,
      normalized,
      hasTimezone,
      iso,
      isValid,
      asUtcIso: isValid ? parsed.toISOString() : null,
      asMontevideo: isValid
        ? parsed.toLocaleString('es-UY', {
            timeZone: BUSINESS_TIMEZONE,
            hour12: false
          })
        : null
    });
  }

  return isValid ? parsed : null;
}

function formatClock(value) {
  const date = parseApiDate(value);

  if (!date) {
    return 'Ahora';
  }

  return date.toLocaleTimeString('es-UY', {
    timeZone: BUSINESS_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function formatDateTime(value) {
  const date = parseApiDate(value);

  if (!date) {
    return 'Ahora';
  }

  const day = date.toLocaleDateString('es-UY', {
    timeZone: BUSINESS_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const time = date.toLocaleTimeString('es-UY', {
    timeZone: BUSINESS_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return `${day} · ${time}`;
}

function getScannerIdleMinutes(updatedAt, now = new Date()) {
  const updatedAtDate = parseApiDate(updatedAt);
  const updatedAtMs = updatedAtDate?.getTime() || Number.NaN;
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();

  if (Number.isNaN(updatedAtMs) || Number.isNaN(nowMs)) {
    return null;
  }

  return Math.max(0, (nowMs - updatedAtMs) / 60000);
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
    type: payload?.type || 'sale',
    amount: Number(payload?.amount || 0),
    description: payload?.description || (payload?.type === 'payment' ? 'Pago registrado' : 'Venta desde escaner'),
    source: payload?.source || 'scanner',
    operatorName: payload?.operator?.name || payload?.operator_name || 'Operario',
    operatorRole: payload?.operator?.role || payload?.operator_role || null,
    items,
    createdAt: payload?.created_at || payload?.createdAt || new Date().toISOString()
  };
}

function normalizeRecentMovements(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((payload) => normalizeLiveSale({
    movement_id: payload?.movement_id || payload?.id,
    type: payload?.type,
    amount: payload?.amount,
    description: payload?.description,
    source: payload?.source,
    operator: payload?.operator || {
      name: payload?.operator_name,
      role: payload?.operator_role
    },
    items: payload?.items,
    created_at: payload?.created_at
  }));
}

function normalizeRankingItems(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item, index) => ({
    rank: Number(item?.rank || index + 1),
    productName: item?.product_name || 'Producto',
    barcode: item?.barcode || null,
    totalQuantity: Number(item?.total_quantity || 0),
    imageUrl: resolveProductImage(item?.product_image),
    hasImage: Boolean(item?.has_image && item?.product_image)
  }));
}

function resolveProductImage(imageValue) {
  if (!imageValue) {
    return '';
  }

  if (
    imageValue.startsWith('http://') ||
    imageValue.startsWith('https://') ||
    imageValue.startsWith('data:image/')
  ) {
    return imageValue;
  }

  return `data:image/jpeg;base64,${imageValue}`;
}

function formatMovementAmount(value, type = 'sale') {
  const formatted = money(value);
  return type === 'payment' ? `- ${formatted}` : `+ ${formatted}`;
}

function getScannerStatusBadge(updatedAt, hasItems, now = new Date()) {
  const idleMinutes = getScannerIdleMinutes(updatedAt, now);

  if (idleMinutes === null && hasItems) {
    return { label: 'Activo', bg: 'success', text: 'light', tone: 'active' };
  }

  if (idleMinutes !== null && idleMinutes < 5) {
    return { label: 'Activo', bg: 'success', text: 'light', tone: 'active' };
  }

  return { label: 'Inactivo', bg: 'secondary', text: 'light', tone: 'idle' };
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
    editing: null,
    manual: null,
    updated_at: null
  });
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
    try {
      if (!quiet) {
        setLoading(true);
      }

      const movementLimit =
        options.movementsMode === 'all'
          ? 'all'
          : options.movementsMode === 'top10'
            ? 10
            : 3;
      const resolvedRankingMode = options.rankingMode || rankingMode;
      const rankingLimit = resolvedRankingMode === 'all' ? 'all' : resolvedRankingMode === 'top10' ? 10 : 5;
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
      logDateDebug('loadDashboard:response', {
        requestedDate: todayDate(),
        requestedCompareTo: yesterdayDate(),
        summarySelectedDate: data?.selected_date || null,
        openCashboxOpenedAt: data?.open_cashbox?.opened_at || null,
        openCashboxClosedAt: data?.open_cashbox?.closed_at || null,
        liveUpdatedAt: liveState?.updated_at || null,
        firstMovementCreatedAt: Array.isArray(movementData?.items) ? movementData.items[0]?.created_at || null : null
      });

      setDashboard(data);
      setLiveSales(normalizeRecentMovements(movementData?.items));
      setRankingItems(normalizeRankingItems(rankingData?.items));
      setRankingMode(resolvedRankingMode);
      setScannerLiveState({
        items: Array.isArray(liveState?.items) ? liveState.items : [],
        total: Number(liveState?.total || 0),
        state: liveState?.state || 'idle',
        operator: liveState?.operator || null,
        editing: liveState?.editing || null,
        manual: liveState?.manual || null,
        updated_at: liveState?.updated_at || null
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
      setMovementsLoading(false);
      setRankingLoading(false);
    }
  }, [handleSessionExpired, rankingMode]);

  useEffect(() => {
    loadDashboardRef.current = loadDashboard;
  }, [loadDashboard]);

  const loadMovements = useCallback(async (mode = movementsMode, quiet = false) => {
    const movementLimit = mode === 'all' ? 'all' : mode === 'top10' ? 10 : 3;

    try {
      if (!quiet) {
        setMovementsLoading(true);
      }

      const movementData = await fetchCashboxMovements({
        date: todayDate(),
        limit: movementLimit
      });
      logDateDebug('loadMovements:response', {
        requestedDate: todayDate(),
        mode,
        totalItems: Array.isArray(movementData?.items) ? movementData.items.length : 0,
        firstMovementCreatedAt: Array.isArray(movementData?.items) ? movementData.items[0]?.created_at || null : null
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
    const rankingLimit = mode === 'all' ? 'all' : mode === 'top10' ? 10 : 5;

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
      try {
        setLoading(true);
        const currentMovementsMode = movementsModeRef.current;
        const currentRankingMode = rankingModeRef.current;
        const movementLimit = currentMovementsMode === 'all' ? 'all' : currentMovementsMode === 'top10' ? 10 : 3;
        const rankingLimit = currentRankingMode === 'all' ? 'all' : currentRankingMode === 'top10' ? 10 : 5;
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
        logDateDebug('bootstrap:response', {
          requestedDate: todayDate(),
          requestedCompareTo: yesterdayDate(),
          summarySelectedDate: data?.selected_date || null,
          openCashboxOpenedAt: data?.open_cashbox?.opened_at || null,
          openCashboxClosedAt: data?.open_cashbox?.closed_at || null,
          liveUpdatedAt: liveState?.updated_at || null,
          firstMovementCreatedAt: Array.isArray(movementData?.items) ? movementData.items[0]?.created_at || null : null
        });

        if (active) {
          setDashboard(data);
          setLiveSales(normalizeRecentMovements(movementData?.items));
          setRankingItems(normalizeRankingItems(rankingData?.items));
          setScannerLiveState({
            items: Array.isArray(liveState?.items) ? liveState.items : [],
            total: Number(liveState?.total || 0),
            state: liveState?.state || 'idle',
            operator: liveState?.operator || null,
            editing: liveState?.editing || null,
            manual: liveState?.manual || null,
            updated_at: liveState?.updated_at || null
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

        logDateDebug('sse:scanner-state', {
          payloadUpdatedAt: payload?.updated_at || null,
          operatorRole: payload?.operator?.role || null
        });
        setScannerLiveState({
          items: Array.isArray(payload.items) ? payload.items : [],
          total: Number(payload.total || 0),
          state: payload.state || 'idle',
          operator: payload.operator || null,
          editing: payload.editing || null,
          manual: payload.manual || null,
          updated_at: payload.updated_at || new Date().toISOString()
        });
        return;
      }

      if (payload.type === 'sale') {
        logDateDebug('sse:sale', {
          payloadCreatedAt: payload?.created_at || null,
          payloadMovementId: payload?.movement_id || null
        });
        if (loadMovementsRef.current) {
          loadMovementsRef.current(movementsModeRef.current, true);
        }
        if (loadRankingRef.current) {
          loadRankingRef.current(rankingModeRef.current, true);
        }
      } else if (payload.type === 'cashbox:opened' || payload.type === 'cashbox:closed') {
        setLiveSales([]);
        setRankingItems([]);
        setScannerLiveState({
          items: [],
          total: 0,
          state: 'idle',
          operator: null,
          editing: null,
          manual: null,
          updated_at: null
        });
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

  const movementSummaryLabel =
    movementsMode === 'all' ? 'Mostrando todo hoy' : movementsMode === 'top10' ? 'Mostrando ultimos 10' : 'Mostrando ultimos 3';

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
      setScannerLiveState({
        items: [],
        total: 0,
        state: 'idle',
        operator: null,
        editing: null,
        manual: null,
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
      setRankingItems([]);
      setScannerLiveState({
        items: [],
        total: 0,
        state: 'idle',
        operator: null,
        editing: null,
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






