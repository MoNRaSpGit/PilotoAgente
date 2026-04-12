import { useCallback, useEffect, useRef, useState } from 'react';
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
} from '../../services/api';
import { clearSession } from '../../store/slices/authSlice';
import { clearAuthSession, getAuthToken } from '../../utils/authSession';
import {
  getScannerStatusBadge,
  normalizeRankingItems,
  normalizeRecentMovements,
  todayDate,
  yesterdayDate
} from './cajaPage.utils';
import {
  createEmptyScannerLiveState,
  getMovementSummaryLabel,
  normalizeScannerLiveState,
  resolveMovementLimit,
  resolveRankingLimit
} from './cajaPage.state';

export function useCajaPageController() {
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
  const loadDashboardRef = useRef(null);
  const loadMovementsRef = useRef(null);
  const movementsModeRef = useRef('recent');
  const loadRankingRef = useRef(null);
  const rankingModeRef = useRef('top5');
  const latestDashboardRequestRef = useRef(0);

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

  return {
    closeConfirmOpen,
    closeCloseConfirmModal,
    closeOpenModal,
    comparisonExpanded,
    expandedMovements,
    handleCloseCashbox,
    handleOpenCashbox,
    handlePaymentSubmit,
    isOpen,
    liveSales,
    loading,
    monthlySummary,
    movementSummaryLabel,
    movementsLoading,
    movementsMode,
    openCashboxInfo,
    openCloseConfirmModal,
    openModal,
    openingAmount,
    paymentForm,
    rankingItems,
    rankingLoading,
    rankingMode,
    savingClose,
    savingOpen,
    savingPayment,
    scannerLiveState,
    scannerStatusBadge,
    selectedDay,
    setComparisonExpanded,
    setOpenModal,
    setOpeningAmount,
    setPaymentForm,
    toggleMovementDetails,
    trend: {
      compareDay,
      weeklySummary,
      monthlySummary
    },
    user,
    loadMovements,
    loadRanking
  };
}
