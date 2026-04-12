import { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { fetchScannerLiveState, syncScannerLiveState } from '../../services/api';
import {
  createManualProductFromBarcode,
  fetchClients,
  registerCashboxSale,
  scanProductByBarcode,
  updateClientCharge,
  updateProduct
} from '../../services/api';
import {
  cloneSaleItems,
  logChargeTiming,
  normalizeDraftItems,
  resolveProductImage
} from './scannerPage.utils';

export function useScannerPageController() {
  const user = useSelector((state) => state.auth.user);
  const userRole = user?.role;
  const barcodeInputRef = useRef(null);
  const manualPriceRef = useRef(null);
  const unknownPriceRef = useRef(null);
  const editPriceRef = useRef(null);
  const pressTimerRef = useRef(null);
  const liveSyncTimerRef = useRef(null);
  const lastLiveSyncSignatureRef = useRef('');
  const liveSyncVersionRef = useRef(0);
  const suppressNextClickRef = useRef(false);
  const [barcode, setBarcode] = useState('');
  const [clients, setClients] = useState([]);
  const [clientQuery, setClientQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [manualPrice, setManualPrice] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [unknownOpen, setUnknownOpen] = useState(false);
  const [unknownPrice, setUnknownPrice] = useState('');
  const [unknownBarcode, setUnknownBarcode] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [chargeOpen, setChargeOpen] = useState(false);
  const [chargeClientConfirmOpen, setChargeClientConfirmOpen] = useState(false);
  const [chargeSnapshotTotal, setChargeSnapshotTotal] = useState(0);
  const [items, setItems] = useState([]);
  const [scannerStateReady, setScannerStateReady] = useState(false);

  const isTouchLikeDevice = useCallback(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return false;
    }

    const coarsePointer = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    return coarsePointer || Number(navigator.maxTouchPoints || 0) > 0;
  }, []);

  const focusScanner = useCallback(({ avoidVirtualKeyboard = true } = {}) => {
    window.setTimeout(() => {
      const input = barcodeInputRef.current;

      if (!input) {
        return;
      }

      if (avoidVirtualKeyboard && isTouchLikeDevice()) {
        const previousReadOnly = input.readOnly;
        input.readOnly = true;
        input.focus();
        window.setTimeout(() => {
          input.readOnly = previousReadOnly;
        }, 60);
        return;
      }

      input.focus();
    }, 0);
  }, [isTouchLikeDevice]);

  useEffect(() => {
    focusScanner();

    return () => {
      if (pressTimerRef.current) {
        window.clearTimeout(pressTimerRef.current);
      }
    };
  }, [focusScanner]);

  useEffect(() => {
    let active = true;

    if (!userRole) {
      setScannerStateReady(true);
      return undefined;
    }

    fetchScannerLiveState({ scope: 'own' })
      .then((snapshot) => {
        if (!active || !snapshot) {
          return;
        }

        setItems(normalizeDraftItems(snapshot.items));
        const snapshotVersion = Number(snapshot.version);
        if (Number.isFinite(snapshotVersion) && snapshotVersion >= 0) {
          liveSyncVersionRef.current = snapshotVersion;
        }
      })
      .catch(() => {
        if (active) {
          setItems([]);
        }
      })
      .finally(() => {
        if (active) {
          setScannerStateReady(true);
        }
      });

    return () => {
      active = false;
    };
  }, [userRole]);

  useEffect(() => {
    if (userRole !== 'admin') {
      return;
    }

    let mounted = true;

    fetchClients()
      .then((itemsList) => {
        if (mounted) {
          setClients(itemsList);
        }
      })
      .catch(() => {
        if (mounted) {
          setClients([]);
        }
      });

    return () => {
      mounted = false;
    };
  }, [userRole]);

  useEffect(() => {
    if (userRole !== 'admin') {
      return undefined;
    }

    const normalizedQuery = clientQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      setSelectedClient(null);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      const nextClient =
        clients.find((client) => String(client.id) === normalizedQuery) ||
        clients.find((client) => String(client.nombre || '').toLowerCase() === normalizedQuery) ||
        clients.find((client) => String(client.nombre || '').toLowerCase().includes(normalizedQuery)) ||
        null;

      if (nextClient) {
        setSelectedClient(nextClient);
        focusScanner();
      } else {
        setSelectedClient(null);
      }
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [clientQuery, clients, focusScanner, userRole]);

  const closeManualModal = () => {
    setManualOpen(false);
  };

  const closeUnknownModal = () => {
    setUnknownOpen(false);
    setUnknownBarcode('');
    setUnknownPrice('');
  };

  const closeEditModal = () => {
    suppressNextClickRef.current = false;
    setEditOpen(false);
    setEditItem(null);
    setEditName('');
    setEditPrice('');
  };

  const closeChargeModal = () => {
    setChargeOpen(false);
  };

  const closeChargeClientConfirm = () => {
    setChargeClientConfirmOpen(false);
    setChargeSnapshotTotal(0);
  };

  const totalAmount = items.reduce((accumulator, item) => accumulator + item.total, 0);
  const selectedClientData = userRole === 'admin' ? selectedClient : null;

  useEffect(() => {
    if (!userRole || !scannerStateReady) {
      return undefined;
    }

    if (liveSyncTimerRef.current) {
      window.clearTimeout(liveSyncTimerRef.current);
    }

    const liveState = {
      version: ++liveSyncVersionRef.current,
      updated_at: new Date().toISOString(),
      state: editOpen && editItem ? 'editing' : manualOpen ? 'manual' : items.length > 0 ? 'active' : 'idle',
      source: 'scanner',
      total: totalAmount,
      items: items.map((item) => ({
        productId: item.productId,
        barcode: item.barcode,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
        source: item.source
      })),
      editing: editOpen && editItem
        ? {
            key: editItem.key,
            name: editName,
            price: editPrice
          }
        : null,
      manual: manualOpen
        ? {
            active: true
          }
        : null,
      operator: {
        id: user?.id || null,
        name: user?.name || null,
        role: userRole || null
      }
    };
    const liveStateSignature = JSON.stringify(liveState);

    if (lastLiveSyncSignatureRef.current === liveStateSignature) {
      return undefined;
    }

    liveSyncTimerRef.current = window.setTimeout(() => {
      lastLiveSyncSignatureRef.current = liveStateSignature;

      syncScannerLiveState(liveState).catch((error) => {
        if (error?.status !== 401 && error?.status !== 403) {
          // Ignore transient sync failures; live-state is best-effort only.
        }
      });
    }, 120);

    return () => {
      if (liveSyncTimerRef.current) {
        window.clearTimeout(liveSyncTimerRef.current);
      }
    };
  }, [items, totalAmount, user, userRole, editOpen, editItem, editName, editPrice, manualOpen, scannerStateReady]);

  useEffect(() => {
    return () => {
      if (liveSyncTimerRef.current) {
        window.clearTimeout(liveSyncTimerRef.current);
      }
    };
  }, []);

  const addItem = (nextItem) => {
    setItems((current) => {
      const existingIndex = current.findIndex((entry) => entry.key === nextItem.key);

      if (existingIndex >= 0) {
        const next = [...current];
        const existing = next[existingIndex];
        const quantity = existing.quantity + 1;

        next[existingIndex] = {
          ...existing,
          quantity,
          total: Number((existing.price * quantity).toFixed(2))
        };

        return next;
      }

      return [...current, nextItem];
    });
  };

  const changeItemQuantity = (itemKey, delta) => {
    setItems((current) =>
      current
        .map((item) => {
          if (item.key !== itemKey) {
            return item;
          }

          const quantity = item.quantity + delta;

          if (quantity <= 0) {
            return null;
          }

          return {
            ...item,
            quantity,
            total: Number((item.price * quantity).toFixed(2))
          };
        })
        .filter(Boolean)
    );
  };

  const handleItemPointerDown = (item) => {
    suppressNextClickRef.current = false;

    if (pressTimerRef.current) {
      window.clearTimeout(pressTimerRef.current);
    }

    pressTimerRef.current = window.setTimeout(() => {
      pressTimerRef.current = null;
      openItemEditor(item);
    }, 2000);
  };

  const openItemEditor = (item) => {
    suppressNextClickRef.current = true;
    clearItemPress();
    setEditItem(item);
    setEditName(item.name);
    setEditPrice(String(item.price));
    setManualOpen(false);
    setUnknownOpen(false);
    setChargeOpen(false);
    setEditOpen(true);
  };

  const clearItemPress = () => {
    if (pressTimerRef.current) {
      window.clearTimeout(pressTimerRef.current);
    }

    pressTimerRef.current = null;
  };

  const handleItemClick = (itemKey) => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }

    changeItemQuantity(itemKey, 1);
    focusScanner();
  };

  const handleEditConfirm = async () => {
    const normalizedPriceInput = String(editPrice).replace(',', '.');
    const price = Number.parseFloat(normalizedPriceInput);
    const name = editName.trim();

    if (!name) {
      toast.error('Ingresa un nombre valido');
      return;
    }

    if (!Number.isFinite(price) || price <= 0) {
      toast.error('Ingresa un valor valido');
      return;
    }

    let persistedProductId = Number(editItem?.productId);

    if (!Number.isFinite(persistedProductId) || persistedProductId <= 0) {
      const candidateBarcode = String(editItem?.barcode || '').trim();
      const isTemporaryManualItem = !candidateBarcode || candidateBarcode.startsWith('manual-');

      if (!isTemporaryManualItem) {
        try {
          const { item: scannedItem } = await scanProductByBarcode(candidateBarcode);
          const resolvedProductId = Number(scannedItem?.id);
          if (Number.isFinite(resolvedProductId) && resolvedProductId > 0) {
            persistedProductId = resolvedProductId;
          }
        } catch (_error) {
          // If lookup fails, keep local edit only for this ticket.
        }
      }
    }

    const shouldPersistProduct = Number.isFinite(persistedProductId) && persistedProductId > 0;

    if (shouldPersistProduct) {
      try {
        await updateProduct(persistedProductId, {
          nombre: name,
          precioVenta: price
        });
      } catch (error) {
        toast.error(error.message || 'No se pudo actualizar el producto en la base');
        return;
      }
    }

    setItems((current) =>
      current.map((item) => {
        if (item.key !== editItem?.key) {
          return item;
        }

        return {
          ...item,
          productId: shouldPersistProduct ? persistedProductId : item.productId,
          name,
          price,
          total: Number((price * item.quantity).toFixed(2))
        };
      })
    );

    closeEditModal();
    focusScanner();
  };

  const handleScanSubmit = async (event) => {
    event.preventDefault();
    let shouldRefocusScanner = true;

    if (!barcode.trim()) {
      focusScanner();
      return;
    }

    try {
      const { item } = await scanProductByBarcode(barcode);
      const price = Number(item.precio_venta);
      const normalizedBarcode = item.barcode_normalized || item.barcode || barcode.trim();

      addItem({
        key: normalizedBarcode,
        productId: item.id || null,
        barcode: normalizedBarcode,
        name: item.nombre,
        price,
        quantity: 1,
        total: Number(price.toFixed(2)),
        imageUrl: resolveProductImage(item.imagen),
        hasImage: Boolean(item.imagen),
        source: 'scan'
      });

      setBarcode('');
    } catch (error) {
      if (error.status === 404) {
        setUnknownBarcode(barcode.trim());
        setUnknownPrice('');
        setUnknownOpen(true);
        shouldRefocusScanner = false;
        return;
      }

      toast.error(error.message);
    } finally {
      if (shouldRefocusScanner) {
        focusScanner();
      }
    }
  };

  const handleManualConfirm = () => {
    const price = Number.parseInt(manualPrice, 10);

    if (!Number.isFinite(price) || price <= 0) {
      toast.error('Ingresa un valor valido');
      focusScanner();
      return;
    }

    const manualKey = `manual-${Date.now()}`;

    addItem({
      key: manualKey,
      productId: null,
      barcode: manualKey,
      name: 'Producto manual',
      price,
      quantity: 1,
      total: Number(price.toFixed(2)),
      imageUrl: '',
      hasImage: false,
      source: 'manual'
    });

    setManualPrice('');
    closeManualModal();
  };

  const handleCharge = () => {
    suppressNextClickRef.current = false;
    setChargeOpen(true);
    setManualOpen(false);
    setEditOpen(false);
  };

  const recordBoxSale = async (saleItems, saleAmount, context = 'general') => {
    const registerSaleStartedAt = performance.now();
    const clearLiveStateVersion = liveSyncVersionRef.current + 1;
    liveSyncVersionRef.current = clearLiveStateVersion;

    const response = await registerCashboxSale({
      amount: saleAmount,
      items: saleItems.map((item) => ({
        productId: item.productId,
        barcode: item.barcode,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.total
      })),
      clear_live_state: true,
      clear_live_state_version: clearLiveStateVersion,
      source: 'scanner',
      description: 'Venta desde escaner'
    });

    logChargeTiming('registerCashboxSale', registerSaleStartedAt, {
      context,
      userRole: userRole || null,
      items: saleItems.length,
      amount: Number(saleAmount || 0),
      serverMs: Number(response?.meta?.total_ms || 0),
      networkAndClientOverheadMs: response?.meta?.network_and_client_overhead_ms ?? null,
      serverRegisterSaleMs: Number(response?.meta?.register_sale_ms || 0)
    });
  };

  const handleChargeConfirm = async () => {
    const totalFlowStartedAt = performance.now();

    if (selectedClientData) {
      setChargeSnapshotTotal(totalAmount);
      closeChargeModal();
      setChargeClientConfirmOpen(true);
      logChargeTiming('openClientConfirmModal', totalFlowStartedAt, {
        context: 'with-client',
        amount: Number(totalAmount || 0),
        items: items.length
      });
      return;
    }

    const saleItemsSnapshot = cloneSaleItems(items);
    const amountSnapshot = Number(totalAmount || 0);
    const itemCountSnapshot = saleItemsSnapshot.length;

    const clearUiStartedAt = performance.now();
    setItems([]);
    setBarcode('');
    setManualPrice('');
    setClientQuery('');
    setSelectedClient(null);
    closeChargeModal();
    setManualOpen(false);
    setEditOpen(false);
    focusScanner();
    logChargeTiming('clearScannerUI', clearUiStartedAt, {
      context: 'without-client'
    });
    logChargeTiming('uiReadyForNextScan', totalFlowStartedAt, {
      context: 'without-client',
      amount: amountSnapshot,
      items: itemCountSnapshot
    });

    void recordBoxSale(saleItemsSnapshot, amountSnapshot, 'without-client')
      .then(() => {
        logChargeTiming('totalFlow', totalFlowStartedAt, {
          context: 'without-client',
          mode: 'background-sale',
          amount: amountSnapshot,
          items: itemCountSnapshot
        });
      })
      .catch((error) => {
        logChargeTiming('error', totalFlowStartedAt, {
          context: 'without-client',
          mode: 'background-sale',
          message: error?.message || 'Error desconocido'
        });
        toast.error(`No se pudo registrar el cobro: ${error?.message || 'error desconocido'}`);
      });
  };

  const handleChargeCancel = () => {
    closeChargeModal();
  };

  const clearSelectedClient = () => {
    setClientQuery('');
    setSelectedClient(null);
    focusScanner();
  };

  const handleChargeToClientConfirm = async () => {
    const totalFlowStartedAt = performance.now();

    if (!selectedClientData || chargeSnapshotTotal <= 0) {
      closeChargeClientConfirm();
      focusScanner();
      return;
    }

    try {
      const today = new Date().toISOString().slice(0, 10);
      await recordBoxSale(items, chargeSnapshotTotal, 'with-client');
      const updateClientStartedAt = performance.now();
      const updated = await updateClientCharge(selectedClientData.id, {
        charge_amount: chargeSnapshotTotal,
        ultima_fecha_pago: today,
        items: items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.total
        }))
      });
      logChargeTiming('updateClientCharge', updateClientStartedAt, {
        context: 'with-client',
        clientId: selectedClientData.id
      });

      const clearUiStartedAt = performance.now();
      setClients((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      setItems([]);
      setBarcode('');
      setManualPrice('');
      clearSelectedClient();
      toast.success(`Se agrego ${chargeSnapshotTotal.toFixed(2)} a ${updated.nombre}`);
      closeChargeClientConfirm();
      setChargeOpen(false);
      setManualOpen(false);
      setEditOpen(false);
      focusScanner();
      logChargeTiming('clearScannerUI', clearUiStartedAt, {
        context: 'with-client',
        clientId: selectedClientData.id
      });
      logChargeTiming('totalFlow', totalFlowStartedAt, {
        context: 'with-client',
        clientId: selectedClientData.id,
        amount: Number(chargeSnapshotTotal || 0),
        items: items.length
      });
    } catch (error) {
      logChargeTiming('error', totalFlowStartedAt, {
        context: 'with-client',
        clientId: selectedClientData?.id || null,
        message: error?.message || 'Error desconocido'
      });
      toast.error(error.message);
      closeChargeClientConfirm();
      focusScanner();
    }
  };

  const handleUnknownConfirm = async () => {
    const price = Number.parseFloat(unknownPrice);

    if (!Number.isFinite(price) || price <= 0) {
      toast.error('Ingresa un valor valido');
      focusScanner();
      return;
    }

    try {
      const { item } = await createManualProductFromBarcode({
        barcode: unknownBarcode,
        precioVenta: price
      });

      addItem({
        key: item.barcode_normalized || item.barcode || unknownBarcode,
        productId: item.id || null,
        barcode: item.barcode_normalized || item.barcode || unknownBarcode,
        name: item.nombre,
        price: Number(item.precio_venta),
        quantity: 1,
        total: Number(Number(item.precio_venta).toFixed(2)),
        imageUrl: resolveProductImage(item.imagen),
        hasImage: Boolean(item.imagen),
        source: 'manual-barcode'
      });

      setBarcode('');
      closeUnknownModal();
      focusScanner();
    } catch (error) {
      if (error.status === 409 && error.data?.item) {
        const item = error.data.item;

        addItem({
          key: item.barcode_normalized || item.barcode || unknownBarcode,
          productId: item.id || null,
          barcode: item.barcode_normalized || item.barcode || unknownBarcode,
          name: item.nombre,
          price: Number(item.precio_venta),
          quantity: 1,
          total: Number(Number(item.precio_venta).toFixed(2)),
          imageUrl: resolveProductImage(item.imagen),
          hasImage: Boolean(item.imagen),
          source: 'manual-barcode'
        });

        setBarcode('');
        closeUnknownModal();
        focusScanner();
        return;
      }

      toast.error(error.message);
      focusScanner();
    }
  };

  return {
    barcodeInputRef,
    manualPriceRef,
    unknownPriceRef,
    editPriceRef,
    barcode,
    setBarcode,
    userRole,
    clientQuery,
    setClientQuery,
    setSelectedClient,
    clients,
    focusScanner,
    clearSelectedClient,
    selectedClient,
    manualOpen,
    setManualOpen,
    manualPrice,
    setManualPrice,
    closeManualModal,
    handleManualConfirm,
    unknownOpen,
    unknownPrice,
    setUnknownPrice,
    closeUnknownModal,
    handleUnknownConfirm,
    editOpen,
    editName,
    setEditName,
    editPrice,
    setEditPrice,
    closeEditModal,
    handleEditConfirm,
    chargeOpen,
    closeChargeModal,
    totalAmount,
    handleChargeCancel,
    handleChargeConfirm,
    selectedClientData,
    chargeClientConfirmOpen,
    closeChargeClientConfirm,
    chargeSnapshotTotal,
    handleChargeToClientConfirm,
    items,
    handleItemPointerDown,
    clearItemPress,
    handleItemClick,
    openItemEditor,
    changeItemQuantity,
    handleCharge,
    handleScanSubmit
  };
}
