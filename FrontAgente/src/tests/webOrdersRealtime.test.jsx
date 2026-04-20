import { describe, expect, it } from 'vitest';
import { applyAdminWebOrderEvent, normalizeWebOrderStatus } from '../pages/webOrders/webOrdersRealtime';

describe('webOrdersRealtime', () => {
  it('normaliza estados legacy', () => {
    expect(normalizeWebOrderStatus('nuevo')).toBe('pendiente');
    expect(normalizeWebOrderStatus('listo para cobrar')).toBe('listo');
    expect(normalizeWebOrderStatus('preparando')).toBe('en_proceso');
  });

  it('agrega pedido nuevo visible para admin', () => {
    const next = applyAdminWebOrderEvent([], {
      type: 'order_created',
      order_id: 10,
      order: {
        id: 10,
        estado: 'pendiente',
        admin_visible: 1
      }
    });

    expect(next).toHaveLength(1);
    expect(next[0].id).toBe(10);
  });

  it('elimina pedido cuando admin_visible pasa a 0', () => {
    const current = [{
      id: 10,
      estado: 'entregado',
      admin_visible: 1
    }];

    const next = applyAdminWebOrderEvent(current, {
      type: 'order_hidden_by_admin',
      order_id: 10,
      order: {
        id: 10,
        estado: 'entregado',
        admin_visible: 0
      }
    });

    expect(next).toHaveLength(0);
  });
});
