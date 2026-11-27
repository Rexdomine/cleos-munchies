import { PREORDER_READY_WITHIN_HOURS } from '../domain/order.js';

const FIELDS = [
  ['name', 'Name'],
  ['phone', 'Phone'],
  ['email', 'Email'],
  ['address', 'Address'],
  ['city', 'Town or city'],
  ['postcode', 'Postcode'],
];

const AUTOCOMPLETE = {
  name: 'name',
  phone: 'tel',
  email: 'email',
  postcode: 'postal-code',
  address: 'street-address',
  city: 'address-level2',
};

export function Checkout({ details, setDetails, errors, onSubmit, onBack, submitting, submitError }) {
  const update = (e) => setDetails((current) => ({ ...current, [e.target.name]: e.target.value }));
  return (
    <div className="page-shell">
      <button className="back" onClick={onBack}>← Back to basket</button>
      <p className="eyebrow">Almost there</p>
      <h1>Delivery details</h1>
      <p className="lede">
        Tell us where to send the good stuff. Cleo’s Munchies’ preorder standard is that your food will be ready within {PREORDER_READY_WITHIN_HOURS} hours.
      </p>
      <form onSubmit={onSubmit} noValidate>
        <div className="form-grid">
          {FIELDS.map(([name, label]) => (
            <label key={name}>
              {label}
              <input
                name={name}
                type={name === 'email' ? 'email' : 'text'}
                inputMode={name === 'phone' ? 'tel' : undefined}
                autoComplete={AUTOCOMPLETE[name]}
                value={details[name]}
                onChange={update}
                required={true}
                aria-invalid={!!errors[name]}
                aria-describedby={errors[name] ? `${name}-error` : undefined}
              />
              {errors[name] && <small className="error" id={`${name}-error`}>{errors[name]}</small>}
            </label>
          ))}
          <label className="full">
            Notes (optional)
            <textarea name="notes" value={details.notes} onChange={update} placeholder="Allergies, gate codes or delivery notes" />
          </label>
        </div>
        {submitError && <p className="error" role="alert">{submitError}</p>}
        <button className="primary" type="submit" disabled={submitting}>
          {submitting ? 'Sending order…' : 'Review order'} <span aria-hidden="true">→</span>
        </button>
      </form>
    </div>
  );
}
