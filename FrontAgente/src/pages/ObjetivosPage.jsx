import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Modal } from 'react-bootstrap';
import { Smile } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { API_URL, fetchCashboxObjectives } from '../services/api';
import { clearSession } from '../store/slices/authSlice';
import { clearAuthSession, getAuthToken } from '../utils/authSession';

function progressPercent(current, goal) {
  if (!Number.isFinite(goal) || goal <= 0) {
    return current > 0 ? 100 : 0;
  }

  return Math.min(100, Math.max(0, Number(((current / goal) * 100).toFixed(1))));
}

function formatMoney(value) {
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: 'UYU',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function levelTone(level) {
  if (level === 'record') {
    return 'record';
  }

  if (level === 'objetivo') {
    return 'objetivo';
  }

  if (level === 'estandar') {
    return 'estandar';
  }

  return 'curso';
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayDate() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

function rewardConfig(type) {
  if (type === 'record') {
    return {
      title: 'Record cumplido',
      reward: 'Mega premio desbloqueado',
      claim: 'Para reclamarlo manda la letra R a Ramon por WhatsApp.'
    };
  }

  return {
    title: 'Objetivo cumplido',
    reward: 'Ganaste un alfajor',
    claim: 'Para reclamarlo manda la letra F a Ramon por WhatsApp.'
  };
}

function ObjetivosPage() {
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
  const progress = data?.progress || {};
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

  if (loading) {
    return (
      <section className="page-section objectives-page">
        <article className="card-panel objectives-hero">
          <h1>Objetivos</h1>
          <p>Cargando objetivos del dia...</p>
        </article>
      </section>
    );
  }

  return (
    <section className="page-section objectives-page">
      <article className="card-panel objectives-hero">
        <div>
          <h1>Objetivos</h1>
          <p className="objectives-hero-copy">
            Cumple objetivos y gana premios <Smile size={18} aria-hidden="true" />
          </p>
        </div>
        <span className={`objectives-level-badge is-${tone}`}>
          {progress.level_label || 'En curso'}
        </span>
      </article>

      <article className="card-panel objectives-progress-card">
        <div className="objectives-progress-head">
          <h3>Ventas hoy</h3>
          <span className="objectives-head-target">{formatMoney(objective)}</span>
        </div>

        <div className="objectives-kpi-grid">
          <div className="objectives-kpi-item">
            <small>Objetivo del dia</small>
            <strong>{formatMoney(objective)}</strong>
          </div>
          <div className="objectives-kpi-item">
            <small>Progreso</small>
            <strong>{formatMoney(currentSales)}</strong>
            <span>{objectiveProgressPercent}% del objetivo</span>
          </div>
          <div className="objectives-kpi-item">
            <small>Te falta</small>
            <strong>{formatMoney(remainingToObjective)}</strong>
            <span>Record: faltan {formatMoney(remainingToRecord)}</span>
          </div>
        </div>

        <div className="objectives-single-progress">
          <div className="objectives-progress-track is-large">
            <div className="objectives-progress-fill is-record" style={{ width: `${fillPercent}%` }} />
            {hasObjectiveGoal ? (
              <div
                className="objectives-marker objectives-marker-objective"
                style={{ left: `${objectiveVisualPercent}%` }}
                role="button"
                tabIndex={0}
                onClick={() => openInfoModal('objetivo')}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openInfoModal('objetivo');
                  }
                }}
              >
                <span className="objectives-flag is-objective" aria-hidden="true" />
                <small>Objetivo</small>
              </div>
            ) : null}
            <div
              className="objectives-marker objectives-marker-record"
              role="button"
              tabIndex={0}
              onClick={() => openInfoModal('record')}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openInfoModal('record');
                }
              }}
            >
              <span className="objectives-flag is-record" aria-hidden="true" />
              <small>Record</small>
            </div>
          </div>

          <p className="objectives-help-text">
            {hasObjectiveGoal
              ? 'Para saber que premio hay hoy, toca la bandera azul y la verde.'
              : 'Hoy no hay objetivo azul. Toca la bandera verde para ver el premio del record.'}
          </p>
        </div>
      </article>

      <Modal
        show={celebrateOpen}
        onHide={() => setCelebrateOpen(false)}
        centered
        restoreFocus={false}
        backdrop="static"
        keyboard={false}
      >
        <Modal.Header closeButton>
          <Modal.Title>{activeReward.title}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="objectives-reward-modal-body">
          <p className="objectives-reward-line">{activeReward.reward}</p>
          <p>{activeReward.claim}</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="dark" onClick={() => setCelebrateOpen(false)}>
            Entendido
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={infoOpen} onHide={() => setInfoOpen(false)} centered restoreFocus={false}>
        <Modal.Header closeButton>
          <Modal.Title>{infoType === 'record' ? 'Premio de Record' : 'Premio de Objetivo'}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="objectives-reward-modal-body">
          {((infoType === 'record' && recordUnlocked) || (infoType === 'objetivo' && objectiveUnlocked)) ? (
            <>
              <p className="objectives-reward-line">{infoReward.reward}</p>
              <p>{infoReward.claim}</p>
            </>
          ) : (
            <>
              <p className="objectives-reward-line">
                {infoType === 'record'
                  ? `Si cumplimos el record ganamos un mega premio.`
                  : `Si cumplimos el objetivo ganamos un alfajor.`}
              </p>
              <p>Se desbloquea automaticamente cuando la barra llega a la meta.</p>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="dark" onClick={() => setInfoOpen(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
    </section>
  );
}

export default ObjetivosPage;
