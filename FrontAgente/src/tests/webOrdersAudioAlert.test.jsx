import { describe, expect, it } from 'vitest';
import {
  getOrderCreatedEventId,
  loadWebOrdersSoundEnabled,
  saveWebOrdersSoundEnabled
} from '../pages/webOrders/webOrdersAudioAlert';

describe('webOrdersAudioAlert', () => {
  it('getOrderCreatedEventId devuelve id solo para order_created valido', () => {
    expect(getOrderCreatedEventId({ type: 'order_created', order_id: 12 })).toBe(12);
    expect(getOrderCreatedEventId({ type: 'order_created', order: { id: 20 } })).toBe(20);
    expect(getOrderCreatedEventId({ type: 'order_status_changed', order_id: 12 })).toBe(0);
    expect(getOrderCreatedEventId({ type: 'order_created', order_id: 0 })).toBe(0);
  });

  it('persiste y recupera preferencia de sonido', () => {
    saveWebOrdersSoundEnabled(false);
    expect(loadWebOrdersSoundEnabled()).toBe(false);

    saveWebOrdersSoundEnabled(true);
    expect(loadWebOrdersSoundEnabled()).toBe(true);
  });
});
