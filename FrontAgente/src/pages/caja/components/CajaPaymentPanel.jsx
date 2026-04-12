import { Button } from 'react-bootstrap';
import { CAJA_ACTION_LABELS } from '../cajaText.constants';

function CajaPaymentPanel({ handlePaymentSubmit, paymentForm, setPaymentForm, savingPayment, isOpen, openCloseConfirmModal, savingClose }) {
  return (
    <article className="card-panel caja-payment-panel caja-payment-panel-compact">
      <div className="panel-heading">
        <div className="caja-panel-copy">
          <h3>Registrar pago</h3>
          <p>Movimientos manuales, en formato liviano.</p>
        </div>
      </div>

      <form className="caja-payment-form caja-payment-form-compact" onSubmit={handlePaymentSubmit}>
        <input
          className="form-control"
          type="text"
          inputMode="decimal"
          pattern="\d*\.?\d*"
          placeholder="Monto"
          value={paymentForm.amount}
          onChange={(event) => {
            const nextValue = event.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
            setPaymentForm((current) => ({
              ...current,
              amount: nextValue
            }));
          }}
        />
        <input
          className="form-control"
          type="text"
          placeholder="Descripcion"
          value={paymentForm.description}
          onChange={(event) => {
            setPaymentForm((current) => ({
              ...current,
              description: event.target.value
            }));
          }}
        />
        <Button type="submit" variant="dark" className="caja-payment-submit" disabled={savingPayment || !isOpen}>
          {savingPayment ? CAJA_ACTION_LABELS.saveInProgress : CAJA_ACTION_LABELS.addPayment}
        </Button>
      </form>

      <div className="caja-close-box">
        <Button variant="dark" onClick={openCloseConfirmModal} disabled={savingClose}>
          {savingClose ? CAJA_ACTION_LABELS.closeInProgress : CAJA_ACTION_LABELS.closeCashbox}
        </Button>
      </div>
    </article>
  );
}

export default CajaPaymentPanel;
