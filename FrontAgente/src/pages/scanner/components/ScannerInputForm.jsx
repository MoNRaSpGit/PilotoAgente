import { Form } from 'react-bootstrap';

function ScannerInputForm({ barcodeInputRef, barcode, setBarcode, handleScanSubmit }) {
  return (
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
  );
}

export default ScannerInputForm;
