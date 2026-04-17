const DEFAULT_TICKET_WIDTH = 32;
const DEFAULT_LEFT_PADDING = 0;
const DEFAULT_FEED_LINES = 8;
const PRODUCT_COLUMN_WIDTH = 21;
const TOTAL_COLUMN_WIDTH = 11;
const ESC = '\x1B';
const BOLD_ON = `${ESC}E\x01`;
const BOLD_OFF = `${ESC}E\x00`;

function toSafeText(value, fallback = '') {
  const normalized = String(value ?? fallback)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '');

  return normalized.trim();
}

function centerText(text, width) {
  const value = toSafeText(text);
  if (!value) {
    return '';
  }

  const leftPadding = Math.max(0, Math.floor((width - value.length) / 2));
  return `${' '.repeat(leftPadding)}${value}`;
}

function lineSeparator(width) {
  return '-'.repeat(width);
}

function formatMoney(value) {
  const numberValue = Number(value || 0);
  const rounded = Math.round(numberValue);
  const formatter = new Intl.NumberFormat('es-UY', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    useGrouping: false
  });

  return `$${formatter.format(rounded)}`;
}

function withLeftPadding(value, leftPadding) {
  return `${' '.repeat(Math.max(0, Number(leftPadding) || 0))}${value}`;
}

function fitLine(value, width) {
  const safeWidth = Math.max(20, Number(width) || DEFAULT_TICKET_WIDTH);
  return String(value || '').slice(0, safeWidth).padEnd(safeWidth, ' ');
}

function padRight(value, width) {
  return String(value || '').slice(0, width).padEnd(width, ' ');
}

function padLeft(value, width) {
  const text = String(value || '');
  if (text.length >= width) {
    return text.slice(text.length - width);
  }

  return text.padStart(width, ' ');
}

function withBold(value) {
  return `${BOLD_ON}${value}${BOLD_OFF}`;
}

function formatItemRow(item) {
  const quantity = Number(item?.quantity || 0);
  const lineName = `${quantity}x ${toSafeText(item?.name || 'Producto')}`;
  const productCell = padRight(lineName, PRODUCT_COLUMN_WIDTH);
  const price = Number(item?.price || 0);
  const resolvedTotal = Number(item?.total || quantity * price);
  const lineTotalLabel = padLeft(formatMoney(resolvedTotal), TOTAL_COLUMN_WIDTH);

  return `${productCell}${lineTotalLabel}`;
}

function formatTotalRow(totalAmount) {
  const totalLabel = padRight('TOTAL', PRODUCT_COLUMN_WIDTH);
  const lineTotalLabel = formatMoney(totalAmount);
  return `${totalLabel}${padLeft(lineTotalLabel, TOTAL_COLUMN_WIDTH)}`;
}

export function createScannerSaleTicketText({
  items = [],
  totalAmount = 0,
  clientName = '',
  storeName = 'PILOTO AGENTE',
  printedAt = new Date(),
  feedLines = DEFAULT_FEED_LINES,
  paperWidth = DEFAULT_TICKET_WIDTH,
  leftPadding = DEFAULT_LEFT_PADDING
} = {}) {
  const safeItems = Array.isArray(items) ? items : [];
  const safeClientName = toSafeText(clientName);
  const safeWidth = Math.max(20, Number(paperWidth) || DEFAULT_TICKET_WIDTH);
  const safeLeftPadding = Math.max(0, Number(leftPadding) || DEFAULT_LEFT_PADDING);
  const printedDate = printedAt instanceof Date ? printedAt : new Date(printedAt);
  const printedLabel = Number.isNaN(printedDate.getTime())
    ? new Date().toLocaleString('es-UY')
    : printedDate.toLocaleString('es-UY');

  let text = '';
  text += `${withLeftPadding(withBold(centerText('SCANER', safeWidth)), safeLeftPadding)}\n`;
  text += `${withLeftPadding(centerText('Ticket de venta', safeWidth), safeLeftPadding)}\n`;
  text += `${withLeftPadding(lineSeparator(safeWidth), safeLeftPadding)}\n`;
  text += `${withLeftPadding(fitLine(`Fecha: ${printedLabel}`, safeWidth), safeLeftPadding)}\n`;
  text += `${withLeftPadding(lineSeparator(safeWidth), safeLeftPadding)}\n`;
  text += `${withLeftPadding(withBold(`${padRight('Producto', PRODUCT_COLUMN_WIDTH)}${padLeft('Total', TOTAL_COLUMN_WIDTH)}`), safeLeftPadding)}\n`;
  text += `${withLeftPadding(lineSeparator(safeWidth), safeLeftPadding)}\n`;

  safeItems.forEach((item) => {
    text += `${withLeftPadding(formatItemRow(item), safeLeftPadding)}\n`;
  });

  text += `${withLeftPadding(lineSeparator(safeWidth), safeLeftPadding)}\n`;
  text += `${withLeftPadding(withBold(formatTotalRow(totalAmount)), safeLeftPadding)}\n`;
  text += `${withLeftPadding(lineSeparator(safeWidth), safeLeftPadding)}\n`;

  if (safeClientName) {
    text += `${withLeftPadding(fitLine(`CLIENTE: ${safeClientName}`, safeWidth), safeLeftPadding)}\n`;
  }

  text += `${withLeftPadding(withBold(centerText('Gracias por su compra', safeWidth)), safeLeftPadding)}\n`;
  text += '\n'.repeat(Math.max(2, Number(feedLines) || DEFAULT_FEED_LINES));

  return text;
}
