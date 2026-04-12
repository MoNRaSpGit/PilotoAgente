export function resolveProductImage(imageValue) {
  if (!imageValue) {
    return '';
  }

  if (
    imageValue.startsWith('http://') ||
    imageValue.startsWith('https://') ||
    imageValue.startsWith('data:image/')
  ) {
    return imageValue;
  }

  return `data:image/jpeg;base64,${imageValue}`;
}

export function elapsedMs(startedAt) {
  return Number((performance.now() - startedAt).toFixed(2));
}

export function logChargeTiming(step, startedAt, details = {}) {
  const durationMs = elapsedMs(startedAt);
  console.info('[scanner:cobro:timing]', { step, durationMs, ...details });
}

export function cloneSaleItems(items = []) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    key: item.key,
    productId: item.productId,
    barcode: item.barcode,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    total: item.total,
    imageUrl: item.imageUrl,
    hasImage: item.hasImage,
    source: item.source
  }));
}

export function normalizeDraftItems(draftItems = []) {
  return (Array.isArray(draftItems) ? draftItems : []).map((item, index) => {
    const price = Number(item?.price || 0);
    const quantity = Number(item?.quantity || 1);
    const total = Number(item?.total || price * quantity);
    const fallbackKey = item?.barcode || `${item?.name || 'item'}-${index}`;

    return {
      key: item?.key || fallbackKey,
      productId: item?.productId || null,
      barcode: item?.barcode || fallbackKey,
      name: item?.name || 'Producto',
      price: Number(price.toFixed(2)),
      quantity,
      total: Number(total.toFixed(2)),
      imageUrl: '',
      hasImage: false,
      source: item?.source || 'scanner'
    };
  });
}
