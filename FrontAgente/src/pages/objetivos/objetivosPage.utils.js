export const BUSINESS_TIMEZONE = 'America/Montevideo';

export function progressPercent(current, goal) {
  if (!Number.isFinite(goal) || goal <= 0) {
    return current > 0 ? 100 : 0;
  }

  return Math.min(100, Math.max(0, Number(((current / goal) * 100).toFixed(1))));
}

export function formatMoney(value) {
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: 'UYU',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

export function levelTone(level) {
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

export function toLocalIsoDate(date) {
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
    return new Date().toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

export function todayDate() {
  return toLocalIsoDate(new Date());
}

export function yesterdayDate() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return toLocalIsoDate(date);
}

export function rewardConfig(type) {
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
