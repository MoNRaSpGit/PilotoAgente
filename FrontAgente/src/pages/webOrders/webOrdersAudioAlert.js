const WEB_ORDERS_SOUND_PREF_KEY = 'frontagente:web-orders-sound-enabled';

export function loadWebOrdersSoundEnabled() {
  if (typeof window === 'undefined') {
    return true;
  }

  const raw = window.localStorage.getItem(WEB_ORDERS_SOUND_PREF_KEY);
  if (raw === '0') {
    return false;
  }
  if (raw === '1') {
    return true;
  }
  return true;
}

export function saveWebOrdersSoundEnabled(enabled) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(WEB_ORDERS_SOUND_PREF_KEY, enabled ? '1' : '0');
}

export function getOrderCreatedEventId(payload) {
  if (!payload || String(payload.type || '') !== 'order_created') {
    return 0;
  }
  const eventOrderId = Number(payload?.order_id || payload?.order?.id || 0);
  return Number.isFinite(eventOrderId) && eventOrderId > 0 ? eventOrderId : 0;
}

export function createWebOrdersBeepPlayer() {
  let context = null;

  function ensureContext() {
    if (typeof window === 'undefined') {
      return null;
    }

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      return null;
    }

    if (!context) {
      context = new AudioContextCtor();
    }

    if (context.state === 'suspended') {
      context.resume().catch(() => {});
    }

    return context;
  }

  function play() {
    const audioContext = ensureContext();
    if (!audioContext) {
      return;
    }

    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, now);
    oscillator.frequency.exponentialRampToValueAtTime(1320, now + 0.08);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.24, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.24);
  }

  function destroy() {
    if (context && typeof context.close === 'function') {
      context.close().catch(() => {});
    }
    context = null;
  }

  return {
    play,
    destroy
  };
}
