import PublicNav from '../_components/PublicNav';
import CustomerBot from '../_components/CustomerBot';

export default function DesignPreviewGallery() {
  return (
    <div>
      <PublicNav current="gallery" />
      <div className="wrap" style={{ paddingTop: 50, paddingBottom: 60 }}>
        <div className="eyebrow">Gallery</div>
        <h1 style={{ fontSize: 28, marginBottom: 24 }}>A look inside</h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14 }}>
          <div style={{ aspectRatio: '1', borderRadius: 'var(--radius-lg)', background: 'var(--surface-2)', border: '1px solid var(--line)' }} />
          <div style={{ aspectRatio: '1', borderRadius: 'var(--radius-lg)', background: 'var(--accent-soft)', border: '1px solid var(--line)' }} />
          <div style={{ aspectRatio: '1', borderRadius: 'var(--radius-lg)', background: 'var(--surface-2)', border: '1px solid var(--line)' }} />
          <div style={{ aspectRatio: '1', borderRadius: 'var(--radius-lg)', background: 'var(--accent-soft)', border: '1px solid var(--line)' }} />
        </div>
      </div>
      <CustomerBot />
    </div>
  );
}
