import { useEffect, useRef, useState } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { fetchScannerLiveState, syncScannerLiveState } from '../services/api';
import {
  createManualProductFromBarcode,
  fetchClients,
  registerCashboxSale,
  scanProductByBarcode,
  updateClientCharge
} from '../services/api';

function resolveProductImage(imageValue) {
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

function elapsedMs(startedAt) {
  return Number((performance.now() - startedAt).toFixed(2));
}

function logChargeTiming(step, startedAt, details = {}) {
  const durationMs = elapsedMs(startedAt);
  console.info('[scanner:cobro:timing]', { step, durationMs, ...details });
}

function cloneSaleItems(items = []) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    key: item.key,
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

function ScannerPage() {
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

  const normalizeDraftItems = (draftItems = []) =>
    (Array.isArray(draftItems) ? draftItems : []).map((item, index) => {
      const price = Number(item?.price || 0);
      const quantity = Number(item?.quantity || 1);
      const total = Number(item?.total || price * quantity);
      const fallbackKey = item?.barcode || `${item?.name || 'item'}-${index}`;

      return {
        key: item?.key || fallbackKey,
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

  const isTouchLikeDevice = () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return false;
    }

    const coarsePointer = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    return coarsePointer || Number(navigator.maxTouchPoints || 0) > 0;
  };

  const focusScanner = ({ avoidVirtualKeyboard = true } = {}) => {
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
  };

  useEffect(() => {
    focusScanner();

    return () => {
      if (pressTimerRef.current) {
        window.clearTimeout(pressTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let active = true;

    if (!userRole) {
      setScannerStateReady(true);
      return undefined;
    }

    fetchScannerLiveState()
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
  }, [clientQuery, clients, userRole]);

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

  const handleEditConfirm = () => {
    const price = Number.parseFloat(editPrice);
    const name = editName.trim();

    if (!name) {
      toast.error('Ingresa un nombre valido');
      return;
    }

    if (!Number.isFinite(price) || price <= 0) {
      toast.error('Ingresa un valor valido');
      return;
    }

    setItems((current) =>
      current.map((item) => {
        if (item.key !== editItem?.key) {
          return item;
        }

        return {
          ...item,
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

  return (
    <section className="page-section scanner-page">
      <div className="scanner-shell">
        <Form onSubmit={handleScanSubmit} className="scanner-form">
          <Form.Control
            ref={barcodeInputRef}
            className="scanner-input"
            value={barcode}
            onChange={(event) => setBarcode(event.target.value)}
            placeholder="Escanea aqui"
            autoComplete="off"
            inputMode="numeric"
          />
        </Form>

        {userRole === 'admin' ? (
          <div className="scanner-client-box">
            <div className="scanner-client-search">
              <Form.Control
                type="text"
                value={clientQuery}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setClientQuery(nextValue);
                  setSelectedClient(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    const normalizedQuery = String(clientQuery).trim().toLowerCase();
                    const nextClient =
                      clients.find((client) => String(client.id) === normalizedQuery) ||
                      clients.find((client) => String(client.nombre || '').toLowerCase() === normalizedQuery) ||
                      clients.find((client) => String(client.nombre || '').toLowerCase().includes(normalizedQuery)) ||
                      null;

                    if (nextClient) {
                      setSelectedClient(nextClient);
                      focusScanner();
                    }
                  }
                }}
                placeholder="ID o nombre del cliente"
                inputMode="text"
              />
              <Button variant="outline-secondary" onClick={clearSelectedClient}>
                Limpiar
              </Button>
            </div>

            {selectedClient ? (
              <div className="scanner-client-selected">
                <div>
                  <strong>{selectedClient.nombre}</strong>
                </div>
                <div>
                  <span>Deuda</span>
                  <strong>${Number(selectedClient.saldo).toFixed(2)}</strong>
                </div>
                <div>
                  <span>Estado</span>
                  <strong className={`client-status-pill client-status-${selectedClient.status}`}>
                    {selectedClient.status === 'entrega'
                      ? 'Casi al dia'
                      : selectedClient.status === 'alerta'
                        ? 'Por vencer'
                        : selectedClient.status === 'vencido'
                          ? 'Vencido'
                          : 'Al dia'}
                  </strong>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="scanner-actions">
          <Button
            variant="dark"
            size="lg"
            className="scanner-manual-button"
            onClick={() => setManualOpen(true)}
          >
            Producto Manual
          </Button>
        </div>

        <div className="scanner-ticket-panel">
          <div className="scanner-list">
            {items.length === 0 ? (
              <p className="empty-copy scanner-empty">Todavia no agregaste productos.</p>
            ) : (
              items.map((item, index) => (
                <div
                  className={`scanner-item ${index === items.length - 1 ? 'scanner-item-latest' : ''}`}
                  key={item.key}
                  role="button"
                  tabIndex={0}
                  onPointerDown={() => handleItemPointerDown(item)}
                  onPointerUp={clearItemPress}
                  onPointerLeave={clearItemPress}
                  onPointerCancel={clearItemPress}
                  onClick={() => handleItemClick(item.key)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleItemClick(item.key);
                    }
                  }}
                >
                  <div className="scanner-item-main">
                    {item.hasImage ? (
                      <img className="scanner-product-image" src={item.imageUrl} alt={item.name} loading="lazy" />
                    ) : (
                      <div className="scanner-product-fallback">IMG</div>
                    )}
                    <div className="scanner-item-text">
                      <span className="scanner-item-name">{item.name}</span>
                      <span className="scanner-item-price">${item.price.toFixed(2)}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="scanner-item-edit"
                    aria-label={`Editar ${item.name}`}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      openItemEditor(item);
                    }}
                  >
                    Editar
                  </button>

                  <div className="scanner-item-meta">
                    <span className="scanner-meta-pill scanner-meta-pill-soft">x{item.quantity}</span>
                    <span className="scanner-meta-pill scanner-meta-pill-strong">${item.total.toFixed(2)}</span>
                    <button
                      type="button"
                      className="scanner-item-remove"
                      aria-label={`Reducir ${item.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        changeItemQuantity(item.key, -1);
                        focusScanner();
                      }}
                    >
                      &times;
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {items.length > 0 ? (
            <div className="scanner-ticket-footer">
              <div className="scanner-ticket-total">
                <span>Total</span>
                <strong>${totalAmount.toFixed(2)}</strong>
              </div>

              <Button className="scanner-charge-button" variant="dark" size="lg" onClick={handleCharge}>
                Cobrar
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <Modal
        show={manualOpen}
        onHide={closeManualModal}
        onEntered={() => manualPriceRef.current?.focus()}
        onExited={focusScanner}
        centered
        restoreFocus={false}
      >
        <Modal.Header closeButton>
          <Modal.Title>Agregar Producto Manual</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Control
            ref={manualPriceRef}
            type="text"
            value={manualPrice}
            onChange={(event) => {
              const nextValue = event.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
              setManualPrice(nextValue);
            }}
            placeholder="Valor"
            inputMode="decimal"
            pattern="\d*\.?\d*"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleManualConfirm();
              }
            }}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={closeManualModal}>
            Cancelar
          </Button>
          <Button onClick={handleManualConfirm}>Agregar</Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={unknownOpen}
        onHide={closeUnknownModal}
        onEntered={() => unknownPriceRef.current?.focus()}
        onExited={focusScanner}
        centered
        restoreFocus={false}
      >
        <Modal.Header closeButton>
          <Modal.Title>Agregar Producto Manual</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Control
            ref={unknownPriceRef}
            type="text"
            value={unknownPrice}
            onChange={(event) => {
              const nextValue = event.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
              setUnknownPrice(nextValue);
            }}
            placeholder="Valor"
            inputMode="decimal"
            pattern="\d*\.?\d*"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleUnknownConfirm();
              }
            }}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={closeUnknownModal}>
            Cancelar
          </Button>
          <Button onClick={handleUnknownConfirm}>Agregar</Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={editOpen}
        onHide={closeEditModal}
        onEntered={() => editPriceRef.current?.focus()}
        onExited={focusScanner}
        centered
        restoreFocus={false}
      >
        <Modal.Header closeButton>
          <Modal.Title>Editar producto</Modal.Title>
        </Modal.Header>
        <Modal.Body className="scanner-edit-body">
          <Form.Group className="mb-3">
            <Form.Label>Nombre</Form.Label>
            <Form.Control
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              placeholder="Nombre"
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Precio</Form.Label>
            <Form.Control
              ref={editPriceRef}
              type="text"
              value={editPrice}
              onChange={(event) => {
                const nextValue = event.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
                setEditPrice(nextValue);
              }}
              placeholder="Valor"
              inputMode="decimal"
              pattern="\d*\.?\d*"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleEditConfirm();
                }
              }}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={closeEditModal}>
            Cancelar
          </Button>
          <Button variant="dark" onClick={handleEditConfirm}>
            Guardar
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={chargeOpen}
        onHide={closeChargeModal}
        onExited={focusScanner}
        centered
        size="lg"
        dialogClassName="scanner-charge-modal"
        restoreFocus={false}
      >
        <Modal.Header closeButton>
          <Modal.Title>Cobro</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="scanner-charge-summary">
            <span>Total</span>
            <strong>${totalAmount.toFixed(2)}</strong>
          </div>
        </Modal.Body>
        <Modal.Footer className="scanner-charge-footer">
          <Button variant="outline-secondary" onClick={handleChargeCancel}>
            Cancelar
          </Button>
          <Button variant="dark" onClick={handleChargeConfirm}>
            {selectedClientData ? 'Siguiente' : 'Confirmar'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={chargeClientConfirmOpen}
        onHide={closeChargeClientConfirm}
        onExited={focusScanner}
        centered
        restoreFocus={false}
      >
        <Modal.Header closeButton>
          <Modal.Title>Confirmar credito</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="scanner-charge-summary">
            <span>{selectedClientData ? `${selectedClientData.nombre} - ID ${selectedClientData.id}` : 'Cliente'}</span>
            <strong>${chargeSnapshotTotal.toFixed(2)}</strong>
          </div>
          <p className="empty-copy scanner-client-confirm-copy">
            Seguro que queres agregar ese monto a este cliente?
          </p>
        </Modal.Body>
        <Modal.Footer className="scanner-charge-footer">
          <Button variant="outline-secondary" onClick={closeChargeClientConfirm}>
            Cancelar
          </Button>
          <Button variant="dark" onClick={handleChargeToClientConfirm}>
            Confirmar
          </Button>
        </Modal.Footer>
      </Modal>
    </section>
  );
}

export default ScannerPage;
