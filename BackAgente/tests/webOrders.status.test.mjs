import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOWED_WEB_ORDER_STATUSES,
  canHideWebOrder,
  normalizeWebOrderStatus
} from '../src/modules/webOrders/webOrders.status.js';

test('normalizeWebOrderStatus normaliza valores legacy', () => {
  assert.equal(normalizeWebOrderStatus('nuevo'), 'pendiente');
  assert.equal(normalizeWebOrderStatus('visto'), 'pendiente');
  assert.equal(normalizeWebOrderStatus('preparando'), 'en_proceso');
  assert.equal(normalizeWebOrderStatus('listo para cobrar'), 'listo');
});

test('canHideWebOrder solo permite entregado', () => {
  assert.equal(canHideWebOrder('entregado'), true);
  assert.equal(canHideWebOrder('listo'), false);
  assert.equal(canHideWebOrder('pendiente'), false);
});

test('ALLOWED_WEB_ORDER_STATUSES contiene entregado', () => {
  assert.equal(ALLOWED_WEB_ORDER_STATUSES.has('entregado'), true);
});
