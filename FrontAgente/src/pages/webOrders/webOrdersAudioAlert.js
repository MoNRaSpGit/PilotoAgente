const WEB_ORDERS_SOUND_PREF_KEY = 'frontagente:web-orders-sound-enabled';
const WEB_ORDERS_SOUND_STYLE_KEY = 'frontagente:web-orders-sound-style';

const SOUND_STYLES = [
  { id: 'classic', label: 'Classic', type: 'sine', fromHz: 880, toHz: 1320, attack: 0.015, sustain: 0.24, gain: 0.24 },
  { id: 'urgent', label: 'Urgent', type: 'square', fromHz: 980, toHz: 1680, attack: 0.01, sustain: 0.26, gain: 0.28 },
  { id: 'soft', label: 'Soft', type: 'triangle', fromHz: 720, toHz: 980, attack: 0.02, sustain: 0.3, gain: 0.2 },
  { id: 'deep', label: 'Deep', type: 'sawtooth', fromHz: 520, toHz: 780, attack: 0.015, sustain: 0.3, gain: 0.22 },
  { id: 'ping', label: 'Ping', type: 'sine', fromHz: 1240, toHz: 1860, attack: 0.008, sustain: 0.18, gain: 0.26 }
];

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

export function getWebOrdersSoundStyles() {
  return SOUND_STYLES.map((style) => ({ ...style }));
}

export function loadWebOrdersSoundStyleId() {
  if (typeof window === 'undefined') {
    return SOUND_STYLES[0].id;
  }

  const raw = String(window.localStorage.getItem(WEB_ORDERS_SOUND_STYLE_KEY) || '').trim().toLowerCase();
  if (SOUND_STYLES.some((style) => style.id === raw)) {
    return raw;
  }
  return SOUND_STYLES[0].id;
}

export function saveWebOrdersSoundStyleId(styleId) {
  if (typeof window === 'undefined') {
    return;
  }
  const validStyleId = SOUND_STYLES.some((style) => style.id === styleId) ? styleId : SOUND_STYLES[0].id;
  window.localStorage.setItem(WEB_ORDERS_SOUND_STYLE_KEY, validStyleId);
}

export function getNextWebOrdersSoundStyleId(currentStyleId) {
  const index = SOUND_STYLES.findIndex((style) => style.id === currentStyleId);
  if (index < 0) {
    return SOUND_STYLES[0].id;
  }
  return SOUND_STYLES[(index + 1) % SOUND_STYLES.length].id;
}

export function getWebOrdersSoundStyleLabel(styleId) {
  const style = SOUND_STYLES.find((item) => item.id === styleId);
  return style?.label || SOUND_STYLES[0].label;
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

  function playStyle(styleId) {
    const audioContext = ensureContext();
    if (!audioContext) {
      return;
    }

    const style = SOUND_STYLES.find((item) => item.id === styleId) || SOUND_STYLES[0];
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = style.type;
    oscillator.frequency.setValueAtTime(style.fromHz, now);
    oscillator.frequency.exponentialRampToValueAtTime(style.toHz, now + 0.08);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(style.gain, now + style.attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + style.sustain);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + style.sustain);
  }

  function destroy() {
    if (context && typeof context.close === 'function') {
      context.close().catch(() => {});
    }
    context = null;
  }

  return {
    play,
    playStyle,
    destroy
  };
}
