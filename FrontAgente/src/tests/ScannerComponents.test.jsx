import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import ScannerClientBox from '../pages/scanner/components/ScannerClientBox';
import ScannerInputForm from '../pages/scanner/components/ScannerInputForm';
import ScannerTicketPanel from '../pages/scanner/components/ScannerTicketPanel';

describe('ScannerInputForm', () => {
  it('actualiza barcode y envia formulario', () => {
    const setBarcode = vi.fn();
    const handleScanSubmit = vi.fn((event) => event.preventDefault());

    render(
      <ScannerInputForm
        barcodeInputRef={{ current: null }}
        barcode=""
        setBarcode={setBarcode}
        handleScanSubmit={handleScanSubmit}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/Escanea aqui/i), { target: { value: '779123' } });
    expect(setBarcode).toHaveBeenCalledWith('779123');

    fireEvent.submit(screen.getByRole('textbox'));
    expect(handleScanSubmit).toHaveBeenCalledTimes(1);
  });
});

describe('ScannerClientBox', () => {
  it('renderiza cliente seleccionado y permite limpiar', () => {
    const clearSelectedClient = vi.fn();

    render(
      <ScannerClientBox
        userRole="admin"
        clientQuery=""
        setClientQuery={vi.fn()}
        setSelectedClient={vi.fn()}
        clients={[]}
        focusScanner={vi.fn()}
        clearSelectedClient={clearSelectedClient}
        selectedClient={{ id: 1, nombre: 'Cliente Demo', saldo: 350, status: 'alerta' }}
      />
    );

    expect(screen.getByText(/Cliente Demo/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Limpiar/i }));
    expect(clearSelectedClient).toHaveBeenCalledTimes(1);
  });
});

describe('ScannerTicketPanel', () => {
  it('renderiza item y dispara editar/reducir/cobrar', () => {
    const openItemEditor = vi.fn();
    const changeItemQuantity = vi.fn();
    const handleCharge = vi.fn();

    render(
      <ScannerTicketPanel
        items={[
          {
            key: 'abc',
            name: 'Arroz',
            price: 110,
            quantity: 2,
            total: 220,
            hasImage: false,
            imageUrl: ''
          }
        ]}
        setManualOpen={vi.fn()}
        handleItemPointerDown={vi.fn()}
        clearItemPress={vi.fn()}
        handleItemClick={vi.fn()}
        openItemEditor={openItemEditor}
        changeItemQuantity={changeItemQuantity}
        focusScanner={vi.fn()}
        totalAmount={220}
        handleCharge={handleCharge}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Editar Arroz/i }));
    expect(openItemEditor).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Reducir Arroz/i }));
    expect(changeItemQuantity).toHaveBeenCalledWith('abc', -1);

    fireEvent.click(screen.getByRole('button', { name: /Cobrar/i }));
    expect(handleCharge).toHaveBeenCalledTimes(1);
  });
});
