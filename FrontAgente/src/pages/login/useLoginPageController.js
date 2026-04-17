import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { loginRequest } from '../../services/api';
import { setSession } from '../../store/slices/authSlice';
import { saveAuthSession } from '../../utils/authSession';
import { normalizeRole, QUICK_LOGINS } from './loginPage.constants';

export function useLoginPageController() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const sessionUserRole = useSelector((state) => state.auth.user?.role);
  const sessionToken = useSelector((state) => state.auth.token);
  const [form, setForm] = useState({
    email: QUICK_LOGINS.admin.email,
    password: QUICK_LOGINS.admin.password
  });
  const [loading, setLoading] = useState(false);
  const [logoTapCount, setLogoTapCount] = useState(0);
  const [panelUnlocked, setPanelUnlocked] = useState(false);
  const handledResetRef = useRef(false);

  useEffect(() => {
    if (!sessionToken || !sessionUserRole) {
      return;
    }

    navigate(normalizeRole(sessionUserRole) === 'admin' ? '/caja' : '/scanner', { replace: true });
  }, [navigate, sessionToken, sessionUserRole]);

  useEffect(() => {
    if (!location.state?.resetLoginPanel) {
      handledResetRef.current = false;
      return;
    }

    if (handledResetRef.current) {
      return;
    }

    handledResetRef.current = true;
    setPanelUnlocked(false);
    setLogoTapCount(0);
  }, [location.state]);

  useEffect(() => {
    if (panelUnlocked || logoTapCount < 7) {
      return;
    }

    setPanelUnlocked(true);
    toast.success('Panel de login habilitado');
  }, [logoTapCount, panelUnlocked]);

  const handleChange = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value
    }));
  };

  const handleLoginSuccess = (data) => {
    dispatch(setSession(data));
    saveAuthSession(data);
    toast.success('Sesion iniciada');
    navigate(normalizeRole(data.user?.role) === 'admin' ? '/caja' : '/scanner', { replace: true });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      const data = await loginRequest(form);
      handleLoginSuccess(data);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (role) => {
    const credentials = QUICK_LOGINS[role];

    if (!credentials) {
      return;
    }

    setForm(credentials);
    setLoading(true);

    try {
      const data = await loginRequest(credentials);
      handleLoginSuccess(data);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoTap = () => {
    if (panelUnlocked) {
      return;
    }

    setLogoTapCount((current) => Math.min(current + 1, 7));
  };

  const handleCloseApp = () => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      if (window.Capacitor?.Plugins?.App?.exitApp) {
        window.Capacitor.Plugins.App.exitApp();
        return;
      }

      if (window.navigator?.app?.exitApp) {
        window.navigator.app.exitApp();
        return;
      }

      window.open('', '_self');
      window.close();

      window.setTimeout(() => {
        if (!window.closed) {
          window.location.replace('about:blank');
        }
      }, 120);
    } catch (_error) {
      window.location.replace('about:blank');
    }
  };

  return {
    form,
    loading,
    panelUnlocked,
    handleChange,
    handleSubmit,
    handleQuickLogin,
    handleLogoTap,
    handleCloseApp
  };
}
