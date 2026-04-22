import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCreateOrderPayload,
  parseOrderId,
  parseOrderStatusPayload
} from '../src/modules/webOrders/webOrders.contract.js';

test('parseCreateOrderPayload normaliza payload valido', () => {
  const parsed = parseCreateOrderPayload({
    items: [{ productId: '12', quantity: '2' }],
    paymentMethod: 'POS',
    deliveryMode: 'yo_voy',
    notes: '  hola  '
  });

  assert.deepEqual(parsed.items, [{ product_id: 12, quantity: 2 }]);
  assert.equal(parsed.paymentMethod, 'pos');
  assert.equal(parsed.deliveryMode, 'pickup');
  assert.equal(parsed.notes, 'hola');
});

test('parseCreateOrderPayload falla sin items', () => {
  assert.throws(
    () => parseCreateOrderPayload({ items: [], payment_method: 'efectivo', delivery_mode: 'pickup' }),
    /al menos un producto/i
  );
});

test('parseCreateOrderPayload falla si product_id es invalido', () => {
  assert.throws(
    () => parseCreateOrderPayload({
      items: [{ product_id: 0, quantity: 1 }],
      payment_method: 'efectivo',
      delivery_mode: 'pickup'
    }),
    /productos invalidos/i
  );
});

test('parseOrderStatusPayload valida estado permitido', () => {
  const parsed = parseOrderStatusPayload({ status: 'en proceso' });
  assert.equal(parsed.status, 'en_proceso');
});

test('parseOrderStatusPayload falla con estado invalido', () => {
  assert.throws(() => parseOrderStatusPayload({ status: 'x' }), /estado de pedido invalido/i);
});

test('parseOrderId valida id numerico positivo', () => {
  assert.equal(parseOrderId('15'), 15);
  assert.throws(() => parseOrderId('0'), /pedido invalido/i);
});

