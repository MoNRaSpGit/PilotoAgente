const TICKET_WIDTH = 32;
const DEFAULT_FEED_LINES = 6;

function toSafeText(value, fallback = '') {
  const normalized = String(value ?? fallback)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '');

  return normalized.trim();
}

function centerText(text) {
  const value = toSafeText(text);
  if (!value) {
    return '';
  }

  const leftPadding = Math.max(0, Math.floor((TICKET_WIDTH - value.length) / 2));
  return `${' '.repeat(leftPadding)}${value}`;
}

function lineSeparator() {
  return '-'.repeat(TICKET_WIDTH);
}

function formatMoney(value) {
  const numberValue = Number(value || 0);
  return `$${numberValue.toFixed(2)}`;
}

function formatItemLine(item) {
  const quantity = Number(item?.quantity || 0);
  const price = Number(item?.price || 0);
  const lineTotal = Number(item?.total || quantity * price);
  const quantityLabel = `${quantity}x`;
  const priceLabel = formatMoney(lineTotal);
  const available = Math.max(0, TICKET_WIDTH - quantityLabel.length - priceLabel.length - 2);
  const name = toSafeText(item?.name || 'Producto').slice(0, available).padEnd(available, ' ');

  return `${quantityLabel} ${name} ${priceLabel}`;
}

export function createScannerSaleTicketText({
  items = [],
  totalAmount = 0,
  clientName = '',
  operatorName = '',
  storeName = 'PILOTO AGENTE',
  printedAt = new Date(),
  feedLines = DEFAULT_FEED_LINES
} = {}) {
  const safeItems = Array.isArray(items) ? items : [];
  const safeStoreName = toSafeText(storeName, 'PILOTO AGENTE') || 'PILOTO AGENTE';
  const safeClientName = toSafeText(clientName);
  const safeOperatorName = toSafeText(operatorName);
  const printedDate = printedAt instanceof Date ? printedAt : new Date(printedAt);
  const printedLabel = Number.isNaN(printedDate.getTime())
    ? new Date().toLocaleString('es-UY')
    : printedDate.toLocaleString('es-UY');

  let text = '';
  text += '\n';
  text += `${centerText(safeStoreName)}\n`;
  text += `${lineSeparator()}\n`;
  text += 'TICKET DE VENTA\n';
  text += `${lineSeparator()}\n`;

  safeItems.forEach((item) => {
    text += `${formatItemLine(item)}\n`;
  });

  text += `${lineSeparator()}\n`;
  text += `TOTAL: ${formatMoney(totalAmount)}\n`;

  if (safeClientName) {
    text += `CLIENTE: ${safeClientName}\n`;
  }

  if (safeOperatorName) {
    text += `OPERADOR: ${safeOperatorName}\n`;
  }

  text += `FECHA: ${printedLabel}\n`;
  text += 'GRACIAS POR SU COMPRA\n';
  text += '\n'.repeat(Math.max(2, Number(feedLines) || DEFAULT_FEED_LINES));

  return text;
}
