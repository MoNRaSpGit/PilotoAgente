export function formatDisplayDate(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  }).format(date);
}

export function getRowClass(status) {
  if (status === 'entrega') {
    return 'client-row client-row-delivery';
  }

  if (status === 'vencido') {
    return 'client-row client-row-danger';
  }

  if (status === 'alerta') {
    return 'client-row client-row-warning';
  }

  return 'client-row client-row-ok';
}

export function getStatusLabel(client) {
  if (client.status === 'entrega') {
    return 'Casi al dia';
  }

  if (client.status === 'vencido') {
    return 'Vencido';
  }

  if (client.status === 'alerta') {
    return 'Por vencer';
  }

  return 'Al dia';
}

export const INITIAL_CLIENT_FORM = {
  nombre: '',
  saldo: '',
  ultima_fecha_pago: ''
};

export const INITIAL_DELIVERY_FORM = {
  entrega: ''
};

export const INITIAL_HISTORY_RANGE = {
  from: '',
  to: ''
};
