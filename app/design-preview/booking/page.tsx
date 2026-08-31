import Link from 'next/link';
import PublicNav from '../_components/PublicNav';
import CustomerBot from '../_components/CustomerBot';

const SERVICES = [
  { name: 'Gel Manicure', meta: '45 min', price: '₦8,000' },
  { name: 'Deep Tissue Massage', meta: '60 min', price: '₦15,000' },
  { name: 'Signature Facial', meta: '50 min', price: '₦12,500' },
];

export default function DesignPreviewBooking() {
  return (
    <div>
      <PublicNav />
      <div className="book-shell">
        <div className="book-head">
          <div className="eyebrow">Open now · Closes 8:00 PM</div>
          <h1 style={{ fontSize: 32, marginBottom: 10 }}>Glow Salon</h1>
          <p className="lede" style={{ margin: '0 auto', textAlign: 'center' }}>
            Pick a service below, or just ask.
          </p>
        </div>
        <div className="service-list">
          {SERVICES.map((s) => (
            <Link href="/design-preview/schedule" className="service-row" style={{ cursor: 'pointer', textDecoration: 'none', color: 'inherit' }} key={s.name}>
              <div>
                <h3>{s.name}</h3>
                <div className="meta">{s.meta}</div>
              </div>
              <div className="price">{s.price}</div>
            </Link>
          ))}
        </div>
      </div>
      <CustomerBot />
    </div>
  );
}
