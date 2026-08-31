import PublicNav from '../_components/PublicNav';
import CustomerBot from '../_components/CustomerBot';

export default function DesignPreviewAbout() {
  return (
    <div>
      <PublicNav current="about" />
      <div className="wrap" style={{ maxWidth: 760, paddingTop: 60, paddingBottom: 60 }}>
        <div className="eyebrow">About us</div>
        <h1 style={{ fontSize: 30, marginBottom: 18 }}>Glow Salon</h1>
        <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--ink-soft)' }}>
          Lagos&apos;s go-to for natural hair care since 2019. We&apos;ve built our name on gentle, personalised treatments and a
          space where you can actually relax while you&apos;re taken care of — no rush, no judgement, just good work.
        </p>
      </div>
      <CustomerBot />
    </div>
  );
}
