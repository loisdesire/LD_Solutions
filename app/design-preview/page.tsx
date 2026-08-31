import Link from 'next/link';

export default function DesignPreviewHome() {
  return (
    <div>
      <nav className="site-nav">
        <span className="logo">Vanova</span>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <Link href="/design-preview/login">Login</Link>
        </div>
        <Link href="/design-preview/signup" className="btn btn-primary">
          Start free
        </Link>
      </nav>

      <section className="hero">
        <div className="hero-inner">
          <div>
            <div className="eyebrow">An AI receptionist that actually books</div>
            <h1>An AI receptionist that actually books the appointment.</h1>
            <p className="lede">
              Customers ask for a time on your website or Telegram. Vanova checks your real calendar and confirms it, no
              back-and-forth, 24/7.
            </p>
            <div className="btn-row">
              <Link href="/design-preview/signup" className="btn btn-primary">
                Start free for 14 days
              </Link>
              <Link href="/design-preview/booking" className="btn btn-outline">
                Try live demo
              </Link>
            </div>
          </div>
          <div>
            <div className="wire-hero-module" id="homeVisual" style={{ minHeight: 260, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div className="whm-top">
                <span style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--primary)', color: 'var(--on-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                  G
                </span>
                <span className="tag">Glow Salon · live</span>
              </div>
              <h3 style={{ fontSize: 17 }}>&quot;We&apos;re open till 8 on Fridays now.&quot;</h3>
              <p style={{ color: 'var(--ink-soft)', fontSize: 14, marginTop: 6 }}>Done — Fridays now close at 8:00 PM. Anything else?</p>
            </div>
          </div>
        </div>
      </section>

      <section className="dark-beat">
        <div className="wrap" style={{ paddingTop: 56, paddingBottom: 56 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginBottom: 32 }}>
            <div style={{ maxWidth: 560 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>More than a chatbot</p>
              <h2 style={{ fontSize: 'clamp(1.8rem,3.4vw,2.4rem)', color: '#fff' }}>
                A real message goes all the way to <em style={{ fontStyle: 'italic', color: 'var(--gold)' }}>booked.</em>
              </h2>
            </div>
            <Link href="/design-preview/booking" style={{ fontSize: 14, fontWeight: 600, color: '#fff', textDecoration: 'underline' }}>
              Test the live booking page →
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
            <div className="proof-card">
              <span className="pn">01</span>
              <h3>Customer asks</h3>
              <p>In plain language, on your website or a connected channel.</p>
            </div>
            <div className="proof-card">
              <span className="pn">02</span>
              <h3>Vanova checks</h3>
              <p>Your active services, opening hours, rules, and existing bookings.</p>
            </div>
            <div className="proof-card">
              <span className="pn">03</span>
              <h3>The slot is secured</h3>
              <p>The database blocks conflicting appointments — even if two people try at once.</p>
            </div>
            <div className="proof-card">
              <span className="pn">04</span>
              <h3>Everyone sees it</h3>
              <p>The customer gets confirmation and your dashboard updates.</p>
            </div>
          </div>
        </div>
      </section>

      <section style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' }}>
        <div className="wrap" style={{ paddingTop: 26, paddingBottom: 26, textAlign: 'center' }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-soft)', marginBottom: 16 }}>
            One receptionist. Every channel your customers already use.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 24 }}>
            <span className="chan-item live">Website chat</span>
            <span className="chan-item live">Telegram</span>
            <span className="chan-item">WhatsApp · soon</span>
            <span className="chan-item">Messenger · soon</span>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap" style={{ paddingTop: 70, paddingBottom: 70 }}>
          <div style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto 44px' }}>
            <h2 style={{ fontSize: 'clamp(1.8rem,3.2vw,2.4rem)', marginBottom: 8 }}>
              From message to <em style={{ fontStyle: 'italic', color: 'var(--primary)' }}>booked.</em>
            </h2>
            <p style={{ color: 'var(--ink-soft)', fontSize: 15 }}>A simple path from the first question to a confirmed appointment.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 28 }}>
            {[
              ['01', 'They ask', 'A customer messages you on your website, or on Telegram.'],
              ['02', 'It checks', 'The AI checks your real availability, instantly, against your actual calendar.'],
              ['03', 'It books', "It's confirmed and booked. No back-and-forth, no waiting on you."],
              ['04', 'You see it', 'The appointment lands on your dashboard automatically. You never touch it.'],
            ].map(([num, title, copy]) => (
              <div key={num}>
                <div className="step-num">{num}</div>
                <h3 style={{ fontSize: 19, marginBottom: 6 }}>{title}</h3>
                <p style={{ fontSize: 14.5, color: 'var(--ink-soft)' }}>{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ background: 'var(--surface-2)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="wrap" style={{ paddingTop: 70, paddingBottom: 70 }}>
          <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 44px' }}>
            <h2 style={{ fontSize: 'clamp(1.8rem,3vw,2.2rem)', marginBottom: 8 }}>
              The work gets lighter, <em style={{ fontStyle: 'italic', color: 'var(--primary)' }}>the bookings keep coming.</em>
            </h2>
            <p style={{ color: 'var(--ink-soft)', fontSize: 15 }}>The essentials for running an appointment business, without the busywork around them.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 28 }}>
            {[
              ['Customers just ask', 'No forms, no menus. They type what they want, the AI checks real availability and books it.'],
              ['Real-time availability', 'Respects your hours, buffer times, and existing bookings. No double-bookings, ever.'],
              ['Automatic confirmations', 'The moment someone books, they get an email confirming it. You never have to follow up.'],
              ['Every booking, one dashboard', 'Website, Telegram, and soon WhatsApp. Wherever the message came from, it lands in the same place.'],
              ['Styled for your business', 'Use your logo, accent color, cover image, content, and URL on a booking page that keeps your business front and centre.'],
              ['Team management', 'Invite staff by email, manage roles, and let your whole team work off one shared calendar.'],
            ].map(([title, copy]) => (
              <div className="feat" key={title}>
                <h3>{title}</h3>
                <p>{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap" style={{ paddingTop: 60, paddingBottom: 60, textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(1.7rem,3vw,2.1rem)', marginBottom: 8, maxWidth: 640, marginLeft: 'auto', marginRight: 'auto' }}>
            Built for businesses that <em style={{ fontStyle: 'italic' }}>take appointments.</em>
          </h2>
          <p style={{ color: 'var(--ink-soft)', fontSize: 15, maxWidth: 560, margin: '0 auto 26px' }}>
            Whether you run a salon, clinic, tutoring service, or consulting practice, if your customers need to book time
            with you, this is for you.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
            {[
              'Hair salons & barbershops',
              'Therapy & wellness clinics',
              'Private tutors & coaches',
              'Consultants & advisors',
              'Photographers & studios',
              'Personal trainers',
              'Massage therapists',
              'Music teachers',
            ].map((biz) => (
              <span className="biz-pill" key={biz}>
                {biz}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section style={{ borderTop: '1px solid var(--line)' }} id="pricing">
        <div className="wrap" style={{ paddingTop: 70, paddingBottom: 70 }}>
          <div style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto 40px' }}>
            <h2 style={{ fontSize: 'clamp(1.8rem,3vw,2.2rem)', marginBottom: 8 }}>Two plans. Both start free.</h2>
            <p style={{ color: 'var(--ink-soft)', fontSize: 15 }}>
              Everything you need to take bookings is in the first one. The second adds an AI that answers questions about
              your business.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20, maxWidth: 800, margin: '0 auto' }}>
            <div className="plan-card">
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-faint)' }}>Core</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 700, marginTop: 6 }}>
                ₦15,000<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--ink-faint)' }}> /month</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--ink-faint)', marginTop: 6, marginBottom: 20 }}>14 days free, then billed monthly. Cancel anytime.</p>
              <ul className="plan-list">
                <li>AI receptionist on your website (Telegram included)</li>
                <li>Unlimited bookings and services</li>
                <li>One dashboard for every appointment</li>
                <li>Automatic email confirmations and reminders</li>
                <li>Take deposits and payments with Paystack</li>
                <li>Your own branded booking page and custom domain</li>
                <li>Team accounts for your staff</li>
              </ul>
              <Link href="/design-preview/signup" className="btn btn-outline" style={{ width: '100%', justifyContent: 'center', marginTop: 22 }}>
                Start free for 14 days
              </Link>
            </div>
            <div className="plan-card featured">
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'rgba(255,248,236,0.8)' }}>Business Intelligence</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 700, marginTop: 6 }}>
                ₦20,000<span style={{ fontSize: 14, fontWeight: 400, opacity: 0.7 }}> /month</span>
              </div>
              <p style={{ fontSize: 13, opacity: 0.75, marginTop: 6, marginBottom: 20 }}>Everything in Core, plus:</p>
              <ul className="plan-list" style={{ color: 'rgba(255,248,236,0.9)' }}>
                <li>Ask your data anything: revenue, top customers, busiest hours</li>
                <li>Spot cancellations, no-shows and customers drifting away</li>
                <li>Compare this month to last, in plain language</li>
                <li>Your AI tells customers what&apos;s actually popular, from real bookings</li>
              </ul>
              <Link
                href="/design-preview/signup"
                className="btn"
                style={{ width: '100%', justifyContent: 'center', marginTop: 22, background: '#fff', color: 'var(--primary)' }}
              >
                Start free for 14 days
              </Link>
            </div>
          </div>
          <p style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--ink-faint)', marginTop: 26 }}>
            Not sure? Start on Core. You can change plan from your dashboard later.
          </p>
        </div>
      </section>

      <section className="dark-beat" style={{ textAlign: 'center' }}>
        <div className="wrap" style={{ paddingTop: 80, paddingBottom: 80 }}>
          <h2 style={{ color: '#fff', fontSize: 'clamp(1.8rem,3.4vw,2.5rem)', marginBottom: 28 }}>
            Ready to stop typing <em style={{ fontStyle: 'italic', color: 'var(--gold)' }}>&quot;what time works?&quot;</em>
          </h2>
          <Link href="/design-preview/signup" className="btn btn-primary">
            Start free for 14 days →
          </Link>
        </div>
      </section>

      <footer style={{ padding: '36px 24px', textAlign: 'center', fontSize: 13, color: 'var(--ink-faint)' }}>
        Vanova — an AI receptionist for appointment businesses.
      </footer>
    </div>
  );
}
