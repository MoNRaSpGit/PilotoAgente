import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { API_URL, fetchCashboxObjectives } from '../../services/api';
import { clearSession } from '../../store/slices/authSlice';
import { clearAuthSession, getAuthToken } from '../../utils/authSession';
import {
  formatMoney,
  levelTone,
  progressPercent,
  rewardConfig,
  todayDate,
  yesterdayDate
} from './objetivosPage.utils';

export function useObjetivosPageController() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [celebrateOpen, setCelebrateOpen] = useState(false);
  const [celebrateType, setCelebrateType] = useState('objetivo');
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoType, setInfoType] = useState('objetivo');
  const unlockTrackerRef = useRef({
    date: null,
    objectiveShown: false,
    recordShown: false
  });

  const handleSessionExpired = useCallback(() => {
    dispatch(clearSession());
    clearAuthSession();
    navigate('/login', { replace: true });
    toast.error('Sesion vencida, volve a ingresar');
  }, [dispatch, navigate]);

  const loadObjectives = useCallback(async (quiet = false, options = {}) => {
    try {
      if (!quiet) {
        setLoading(true);
      }

      const result = await fetchCashboxObjectives({
        date: todayDate(),
        compareTo: yesterdayDate(),
        forceRefresh: Boolean(options.forceRefresh)
      });
      setData(result);
    } catch (error) {
      if (error?.status === 401) {
        handleSessionExpired();
        return;
      }

      if (!quiet) {
        toast.error(error?.message || 'No se pudieron cargar los objetivos');
      }
    } finally {
      if (!quiet) {
        setLoading(false);
      }
    }
  }, [handleSessionExpired]);

  useEffect(() => {
    loadObjectives();
  }, [loadObjectives]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }

      loadObjectives(true);
    }, 60000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadObjectives]);

  useEffect(() => {
    const token = getAuthToken();

    if (!token) {
      return undefined;
    }

    const eventSource = new EventSource(`${API_URL}/api/caja/stream?token=${encodeURIComponent(token)}`);
    const handleUpdate = (event) => {
      let payload = {};

      try {
        payload = event?.data ? JSON.parse(event.data) : {};
      } catch (_error) {
        payload = {};
      }

      if (!payload?.type || payload.type === 'scanner:state') {
        return;
      }

      loadObjectives(true, { forceRefresh: true });
    };

    eventSource.addEventListener('cashbox:update', handleUpdate);

    return () => {
      eventSource.removeEventListener('cashbox:update', handleUpdate);
      eventSource.close();
    };
  }, [loadObjectives]);

  const goals = data?.goals || {};
  const progress = useMemo(() => data?.progress || {}, [data?.progress]);
  const currentSales = Number(progress.current_sales || 0);
  const record = Number(goals.record || 0);
  const objective = Number(goals.objective || 0);
  const fillPercent = progressPercent(currentSales, record);
  const objectiveProgressPercent = progressPercent(currentSales, objective);
  const remainingToObjective = Math.max(0, Number(progress.remaining_to_objective || objective - currentSales || 0));
  const remainingToRecord = Math.max(0, Number(progress.remaining_to_record || record - currentSales || 0));
  const objectiveVisualPercentRaw = record > 0
    ? Math.min(100, Math.max(0, Number(((objective / record) * 100).toFixed(1))))
    : 100;
  const objectiveVisualPercent = Math.min(objectiveVisualPercentRaw, 84);
  const tone = levelTone(progress.level);
  const selectedDate = data?.selected_date || todayDate();
  const hasObjectiveGoal = objective > 0;
  const objectiveUnlocked = objective > 0 && currentSales >= objective;
  const recordUnlocked = record > 0 && fillPercent >= 100;
  const activeReward = rewardConfig(celebrateType);
  const infoReward = rewardConfig(infoType);

  useEffect(() => {
    if (unlockTrackerRef.current.date !== selectedDate) {
      unlockTrackerRef.current = {
        date: selectedDate,
        objectiveShown: false,
        recordShown: false
      };
    }

    if (recordUnlocked && !unlockTrackerRef.current.recordShown) {
      unlockTrackerRef.current.recordShown = true;
      setCelebrateType('record');
      setCelebrateOpen(true);
      return;
    }

    if (objectiveUnlocked && !unlockTrackerRef.current.objectiveShown) {
      unlockTrackerRef.current.objectiveShown = true;
      setCelebrateType('objetivo');
      setCelebrateOpen(true);
    }
  }, [objectiveUnlocked, recordUnlocked, selectedDate]);

  const openInfoModal = (type) => {
    setInfoType(type);
    setInfoOpen(true);
  };

  const viewModel = useMemo(() => ({
    formatMoney,
    tone,
    progress,
    objective,
    currentSales,
    objectiveProgressPercent,
    remainingToObjective,
    remainingToRecord,
    hasObjectiveGoal,
    objectiveVisualPercent,
    fillPercent,
    objectiveUnlocked,
    recordUnlocked,
    openInfoModal
  }), [
    tone,
    progress,
    objective,
    currentSales,
    objectiveProgressPercent,
    remainingToObjective,
    remainingToRecord,
    hasObjectiveGoal,
    objectiveVisualPercent,
    fillPercent,
    objectiveUnlocked,
    recordUnlocked
  ]);

  return {
    loading,
    viewModel,
    celebrateOpen,
    setCelebrateOpen,
    activeReward,
    infoOpen,
    setInfoOpen,
    infoType,
    infoReward,
    objectiveUnlocked,
    recordUnlocked
  };
}
