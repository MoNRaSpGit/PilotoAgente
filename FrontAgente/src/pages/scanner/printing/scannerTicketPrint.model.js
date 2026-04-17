const DEFAULT_TICKET_WIDTH = 48;
const DEFAULT_LEFT_PADDING = 2;
const DEFAULT_FEED_LINES = 12;

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
  return `$${numberValue.toFixed(2)}`;
}

function withLeftPadding(value, leftPadding) {
  return `${' '.repeat(Math.max(0, Number(leftPadding) || 0))}${value}`;
}

function fitLine(value, width) {
  const safeWidth = Math.max(20, Number(width) || DEFAULT_TICKET_WIDTH);
  return String(value || '').slice(0, safeWidth).padEnd(safeWidth, ' ');
}

function rightValueLine(label, value, width) {
  const safeLabel = toSafeText(label).toUpperCase();
  const safeValue = toSafeText(value);
  const composed = `${safeLabel}: ${safeValue}`;

  if (composed.length >= width) {
    return composed.slice(0, width);
  }

  const spaces = ' '.repeat(Math.max(0, width - composed.length));
  return `${safeLabel}:${spaces}${safeValue}`;
}

function formatItemBlock(item, width) {
  const quantity = Number(item?.quantity || 0);
  const price = Number(item?.price || 0);
  const lineTotal = Number(item?.total || quantity * price);
  const name = toSafeText(item?.name || 'Producto').toUpperCase();
  const unitPriceLabel = formatMoney(price);
  const lineTotalLabel = formatMoney(lineTotal);
  const quantityLabel = `${quantity} x ${unitPriceLabel}`;
  const gap = Math.max(1, width - quantityLabel.length - lineTotalLabel.length);
  const row2 = `${quantityLabel}${' '.repeat(gap)}${lineTotalLabel}`;

  return [
    fitLine(name, width),
    fitLine(row2, width)
  ];
}

export function createScannerSaleTicketText({
  items = [],
  totalAmount = 0,
  clientName = '',
  operatorName = '',
  storeName = 'PILOTO AGENTE',
  printedAt = new Date(),
  feedLines = DEFAULT_FEED_LINES,
  paperWidth = DEFAULT_TICKET_WIDTH,
  leftPadding = DEFAULT_LEFT_PADDING
} = {}) {
  const safeItems = Array.isArray(items) ? items : [];
  const safeStoreName = toSafeText(storeName, 'PILOTO AGENTE') || 'PILOTO AGENTE';
  const safeClientName = toSafeText(clientName);
  const safeOperatorName = toSafeText(operatorName);
  const safeWidth = Math.max(20, Number(paperWidth) || DEFAULT_TICKET_WIDTH);
  const safeLeftPadding = Math.max(0, Number(leftPadding) || DEFAULT_LEFT_PADDING);
  const printedDate = printedAt instanceof Date ? printedAt : new Date(printedAt);
  const printedLabel = Number.isNaN(printedDate.getTime())
    ? new Date().toLocaleString('es-UY')
    : printedDate.toLocaleString('es-UY');

  let text = '';
  text += `${withLeftPadding(centerText(safeStoreName, safeWidth), safeLeftPadding)}\n`;
  text += `${withLeftPadding(centerText('TICKET DE VENTA', safeWidth), safeLeftPadding)}\n`;
  text += `${withLeftPadding(lineSeparator(safeWidth), safeLeftPadding)}\n`;

  safeItems.forEach((item) => {
    const itemLines = formatItemBlock(item, safeWidth);
    itemLines.forEach((line) => {
      text += `${withLeftPadding(line, safeLeftPadding)}\n`;
    });
    text += `${withLeftPadding(fitLine('', safeWidth), safeLeftPadding)}\n`;
  });

  text += `${withLeftPadding(lineSeparator(safeWidth), safeLeftPadding)}\n`;
  text += `${withLeftPadding(rightValueLine('TOTAL', formatMoney(totalAmount), safeWidth), safeLeftPadding)}\n`;

  if (safeClientName) {
    text += `${withLeftPadding(fitLine(`CLIENTE: ${safeClientName}`, safeWidth), safeLeftPadding)}\n`;
  }

  if (safeOperatorName) {
    text += `${withLeftPadding(fitLine(`OPERADOR: ${safeOperatorName}`, safeWidth), safeLeftPadding)}\n`;
  }

  text += `${withLeftPadding(fitLine(`FECHA: ${printedLabel}`, safeWidth), safeLeftPadding)}\n`;
  text += `${withLeftPadding(lineSeparator(safeWidth), safeLeftPadding)}\n`;
  text += `${withLeftPadding(centerText('GRACIAS POR SU COMPRA', safeWidth), safeLeftPadding)}\n`;
  text += '\n'.repeat(Math.max(2, Number(feedLines) || DEFAULT_FEED_LINES));

  return text;
}
