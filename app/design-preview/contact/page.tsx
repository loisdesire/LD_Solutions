import PublicNav from '../_components/PublicNav';
import CustomerBot from '../_components/CustomerBot';

export default function DesignPreviewContact() {
  return (
    <div>
      <PublicNav current="contact" />
      <div className="wrap" style={{ maxWidth: 600, paddingTop: 60, paddingBottom: 60 }}>
        <div className="eyebrow">Get in touch</div>
        <h1 style={{ fontSize: 28, marginBottom: 24 }}>We&apos;d love to hear from you</h1>
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
            <span style={{ color: 'var(--ink-faint)' }}>Phone</span>
            <span>0803 456 7890</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
            <span style={{ color: 'var(--ink-faint)' }}>Email</span>
            <span>hello@glowsalon.ng</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
            <span style={{ color: 'var(--ink-faint)' }}>Instagram</span>
            <span>@glowsalon.ng</span>
          </div>
        </div>
      </div>
      <CustomerBot />
    </div>
  );
}
