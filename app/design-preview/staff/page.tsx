import AdminNav from '../_components/AdminNav';

// Mirrors the real StaffManager: an avatar + role-pill + actions team
// list, plus a separate dashed-border "Pending invites" section - not a
// plain name/email/role table.
const TEAM = [
  { i: 'C', name: 'Chioma', email: 'owner@glowsalon.com', role: 'Owner', you: true },
  { i: 'B', name: 'Blessing', email: 'blessing@glowsalon.com', role: 'Staff', upcoming: 3 },
];

const INVITES = [{ email: 'tolu@glowsalon.com' }];

export default function DesignPreviewStaff() {
  return (
    <div>
      <AdminNav current="setup" />
      <div className="dash-shell">
        <div className="wrap" style={{ padding: 0 }}>
          <div className="dash-head">
            <div>
              <div className="eyebrow" style={{ marginBottom: 4 }}>
                Set up
              </div>
              <h2 style={{ fontSize: 24, marginBottom: 4 }}>Your team</h2>
              <p style={{ fontSize: 13.5, color: 'var(--ink-soft)' }}>Invite people to help manage bookings for Glow Salon.</p>
            </div>
            <a className="btn btn-primary" href="#">
              + Invite someone
            </a>
          </div>

          <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-faint)', marginBottom: 10 }}>Team</p>
          <div className="card" style={{ marginBottom: 28 }}>
            {TEAM.map((m) => (
              <div className="team-row" key={m.name}>
                <span className="avatar-sm" style={{ marginRight: 0 }}>
                  {m.i}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600 }}>{m.name}</p>
                  <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 2 }}>
                    {m.email}
                    {m.upcoming ? ` · ${m.upcoming} upcoming` : ''}
                  </p>
                </div>
                <span className={`role-pill${m.you ? ' you' : ''}`}>{m.you ? 'You' : m.role}</span>
                <a href="#" style={{ fontSize: 13, color: 'var(--ink-faint)', textDecoration: 'none' }}>
                  Edit
                </a>
                {!m.you && (
                  <a href="#" style={{ fontSize: 13, color: 'var(--ink-faint)', textDecoration: 'none' }}>
                    Remove
                  </a>
                )}
              </div>
            ))}
          </div>

          {INVITES.length > 0 && (
            <div>
              <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-faint)', marginBottom: 10 }}>Pending invites</p>
              <div className="card">
                {INVITES.map((inv) => (
                  <div className="invite-row" key={inv.email}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 500 }}>{inv.email}</p>
                      <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 2 }}>Waiting to accept</p>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', border: '1.5px solid var(--line-strong)', borderRadius: 10, padding: '6px 12px' }}>
                      Copy link
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
