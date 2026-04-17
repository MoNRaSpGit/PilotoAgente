const PRINT_ENABLED = String(import.meta.env.VITE_SCANNER_TICKET_PRINT_ENABLED ?? 'true') === 'true';
const PRINT_MODE = String(import.meta.env.VITE_SCANNER_TICKET_PRINT_MODE ?? 'scheme').toLowerCase();

function buildPrintUrl(ticketText) {
  const encoded = encodeURIComponent(String(ticketText || ''));

  if (PRINT_MODE === 'intent') {
    return `intent://rawbt?data=${encoded}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end`;
  }

  return `rawbt://print?text=${encoded}`;
}

function openUrl(url) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

export function sendScannerTicketToRawBt(ticketText) {
  if (!PRINT_ENABLED) {
    return { ok: false, reason: 'disabled' };
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { ok: false, reason: 'unsupported-runtime' };
  }

  const normalized = String(ticketText || '');

  if (!normalized.trim()) {
    return { ok: false, reason: 'empty-ticket' };
  }

  try {
    openUrl(buildPrintUrl(normalized));
    return { ok: true };
  } catch (_error) {
    return { ok: false, reason: 'open-failed' };
  }
}
