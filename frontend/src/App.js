import React, { useState } from 'react';

const AUTH_URL = 'http://localhost:5050/api/auth';
const INV_URL = 'http://localhost:5050/api/invitations';

function useQuery() {
  const [query] = useState(() => new URLSearchParams(window.location.search));
  return query;
}

function getShareUrl(id) {
  return `${window.location.origin}/?invitation=${id}`;
}

function App() {
  const query = useQuery();
  const invitationIdFromUrl = query.get('invitation') || '';

  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [currentUser, setCurrentUser] = useState(null);

  // Invitation editor state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [rsvpLink, setRsvpLink] = useState('');
  const [createdInvitationId, setCreatedInvitationId] = useState('');

  // Public invitation view
  const [publicInvitation, setPublicInvitation] = useState(null);
  const [rsvpStatus, setRsvpStatus] = useState('attending');
  const [rsvpNotes, setRsvpNotes] = useState('');
  const [rsvpDone, setRsvpDone] = useState(false);

  // Owner dashboard
  const [myInvitations, setMyInvitations] = useState([]);
  const [managedInvitation, setManagedInvitation] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      let url = mode === 'register' ? `${AUTH_URL}/register` : `${AUTH_URL}/login`;
      let body = mode === 'register' ? { username, email, password } : { identifier, password };
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Unknown error'); return; }
      setToken(data.token);
      setCurrentUser(data.user);
      localStorage.setItem('token', data.token);
      setUsername(''); setEmail(''); setPassword(''); setIdentifier('');
    } catch { setError('Network error'); }
  };

  const handleLogout = () => { setToken(''); setCurrentUser(null); localStorage.removeItem('token'); };

  // Fetch user if token exists
  React.useEffect(() => {
    const getMe = async () => {
      if (token && !currentUser) {
        try {
          const res = await fetch(`${AUTH_URL}/me`, { headers: { Authorization: `Bearer ${token}` } });
          const data = await res.json();
          if (res.ok && data.user) setCurrentUser(data.user); else handleLogout();
        } catch { handleLogout(); }
      }
    };
    getMe();
    // eslint-disable-next-line
  }, [token]);

  // Load public invitation if query has id
  React.useEffect(() => {
    const loadInvitation = async () => {
      if (!invitationIdFromUrl) return;
      try {
        const res = await fetch(`${INV_URL}/${invitationIdFromUrl}`);
        const data = await res.json();
        if (res.ok) setPublicInvitation(data);
      } catch {}
    };
    loadInvitation();
  }, [invitationIdFromUrl]);

  // After login, load my invitations and auto-select newest
  React.useEffect(() => {
    const loadMine = async () => {
      if (!currentUser || !token) return;
      try {
        const res = await fetch(`${INV_URL}`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (res.ok) {
          setMyInvitations(data);
          setManagedInvitation(data[0] || null);
        }
      } catch {}
    };
    loadMine();
  }, [currentUser, token]);

  const createInvitation = async () => {
    setError('');
    try {
      const isoDateTime = date && time ? new Date(`${date}T${time}`) : (date ? new Date(date) : null);
      const res = await fetch(INV_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, message, dateTime: isoDateTime, location, rsvpLink })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to create'); return; }
      setCreatedInvitationId(data._id);
      // Prepend to list and select it
      setMyInvitations(prev => [data, ...prev]);
      setManagedInvitation(data);
      // Reset editor
      setTitle(''); setMessage(''); setDate(''); setTime(''); setLocation(''); setRsvpLink('');
    } catch { setError('Network error'); }
  };

  const submitRsvp = async () => {
    if (!publicInvitation) return;
    setError('');
    try {
      const res = await fetch(`${INV_URL}/${publicInvitation._id}/rsvp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: rsvpStatus, notes: rsvpNotes }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to submit RSVP'); return; }
      setRsvpDone(true);
    } catch { setError('Network error'); }
  };

  // Public invitation page
  if (invitationIdFromUrl && publicInvitation) {
    return (
      <div>
        <div style={{ position: 'sticky', top: 0, background: '#fff', borderBottom: '1px solid #eee', padding: '10px 16px' }}>
          <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 700 }}>Invitation</div>
            <a href="/" style={{ textDecoration: 'none' }}>Create your own</a>
          </div>
        </div>
        <div style={{ maxWidth: 480, margin: '3rem auto', padding: 24, border: '1px solid #e6e6e6', borderRadius: 12, textAlign: 'center', boxShadow: '0 6px 18px rgba(0,0,0,0.06)' }}>
          <h2 style={{ margin: 0 }}>{publicInvitation.title}</h2>
          {publicInvitation.dateTime && (<div style={{ fontSize: 13, color: '#666', marginTop: 6 }}>{new Date(publicInvitation.dateTime).toLocaleString()}</div>)}
          {publicInvitation.location && (<div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>{publicInvitation.location}</div>)}
          {publicInvitation.message && (<p style={{ marginTop: 14 }}>{publicInvitation.message}</p>)}
          {!rsvpDone ? (
            <div style={{ marginTop: 16, textAlign: 'left' }}>
              <div style={{ marginBottom: 6, fontWeight: 600 }}>Odgovori</div>
              <select value={rsvpStatus} onChange={e => setRsvpStatus(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd' }}>
                <option value="attending">Attending</option>
                <option value="maybe">Maybe</option>
                <option value="not_attending">Not attending</option>
              </select>
              <textarea value={rsvpNotes} onChange={e => setRsvpNotes(e.target.value)} placeholder="Additional notes" style={{ width: '100%', padding: 10, marginTop: 8, borderRadius: 8, border: '1px solid #ddd' }} />
              <button onClick={submitRsvp} style={{ marginTop: 10, padding: '10px 16px', background: '#2563eb', color: '#fff', border: 0, borderRadius: 8 }}>Submit RSVP</button>
            </div>
          ) : (<div style={{ marginTop: 16, color: 'green' }}>RSVP submitted. Thank you!</div>)}
          {error && <div style={{ color: 'red', marginTop: 10 }}>{error}</div>}
        </div>
      </div>
    );
  }

  // Authenticated dashboard
  if (token && currentUser) {
    return (
      <div>
        {/* Nav Bar */}
        <div style={{ position: 'sticky', top: 0, background: '#ffffffcc', backdropFilter: 'saturate(180%) blur(6px)', borderBottom: '1px solid #eee' }}>
          <div style={{ maxWidth: 960, margin: '0 auto', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontWeight: 800 }}>Invitation Studio</span>
              <a href="#create" style={{ textDecoration: 'none', color: '#2563eb' }}>Create</a>
              <a href="#my" style={{ textDecoration: 'none', color: '#2563eb' }}>My Invitations</a>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, color: '#777' }}>{currentUser.email}</span>
              <button onClick={handleLogout} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #ddd', background: '#fff' }}>Logout</button>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 960, margin: '1.5rem auto', display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
          {/* Left: My Invitations */}
          <div id="my" style={{ border: '1px solid #eee', borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>My Invitations</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {myInvitations.map((inv) => (
                <div key={inv._id} style={{ border: '1px solid #e6e6e6', borderRadius: 10, padding: 10, background: managedInvitation?._id === inv._id ? '#eef2ff' : '#fff' }}>
                  <button onClick={() => setManagedInvitation(inv)} style={{ textAlign: 'left', width: '100%', background: 'transparent', border: 0, cursor: 'pointer' }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{inv.title}</div>
                    <div style={{ fontSize: 12, color: '#777' }}>{inv.dateTime ? new Date(inv.dateTime).toLocaleString() : 'No date'}</div>
                  </button>
                  <div style={{ marginTop: 6, fontSize: 12 }}>
                    Link: <a href={getShareUrl(inv._id)}>{getShareUrl(inv._id)}</a>
                    <button onClick={() => navigator.clipboard.writeText(getShareUrl(inv._id))} style={{ marginLeft: 8, padding: '2px 6px', fontSize: 12 }}>Copy</button>
                  </div>
                </div>
              ))}
              {myInvitations.length === 0 && <div style={{ color: '#888' }}>No invitations yet</div>}
            </div>
          </div>

          {/* Right: Editor + Responses */}
          <div>
            <div id="create" style={{ border: '1px solid #eee', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Create Invitation</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, maxWidth: 520 }}>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
                <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Message" rows={4} style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
                  <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
                </div>
                <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Location" style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
                <input value={rsvpLink} onChange={e => setRsvpLink(e.target.value)} placeholder="RSVP Link (optional)" style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
                <button onClick={createInvitation} style={{ padding: '10px 14px', borderRadius: 8, border: 0, color: '#fff', background: '#16a34a' }}>Publish Invitation</button>
                {createdInvitationId && (
                  <div style={{ fontSize: 12 }}>
                    Share: <a href={getShareUrl(createdInvitationId)}>{getShareUrl(createdInvitationId)}</a>
                    <button onClick={() => navigator.clipboard.writeText(getShareUrl(createdInvitationId))} style={{ marginLeft: 8, padding: '2px 6px', fontSize: 12 }}>Copy</button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 700 }}>Responses</div>
                {managedInvitation && (
                  <div style={{ fontSize: 12, color: '#666' }}>{managedInvitation.responses?.length || 0} total</div>
                )}
              </div>
              {managedInvitation ? (
                <div style={{ marginTop: 10 }}>
                  <div style={{ marginBottom: 8, fontWeight: 600 }}>{managedInvitation.title}</div>
                  <div style={{ marginBottom: 10, fontSize: 12 }}>
                    Share: <a href={getShareUrl(managedInvitation._id)}>{getShareUrl(managedInvitation._id)}</a>
                    <button onClick={() => navigator.clipboard.writeText(getShareUrl(managedInvitation._id))} style={{ marginLeft: 8, padding: '2px 6px', fontSize: 12 }}>Copy</button>
                  </div>
                  {(managedInvitation.responses || []).length === 0 && <div style={{ color: '#888' }}>No responses yet</div>}
                  {(managedInvitation.responses || []).map((r, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 160px', gap: 10, padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <div style={{ textTransform: 'capitalize' }}>{r.status.replace('_',' ')}</div>
                      <div>{r.notes || '-'}</div>
                      <div style={{ color: '#999', fontSize: 12 }}>{new Date(r.createdAt).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#888' }}>Select an invitation to view responses</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Auth screens
  return (
    <div style={{ maxWidth: 420, margin: '3rem auto', padding: 32, border: '1px solid #f0f0f0', borderRadius: 12, boxShadow: '0 6px 18px rgba(0,0,0,0.06)' }}>
      <h2 style={{ textAlign: 'center', margin: 0 }}>{mode === 'login' ? 'Sign In' : 'Register'}</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
        {mode === 'register' ? (
          <>
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" required style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
          </>
        ) : (
          <>
            <input value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="Username or Email" required style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
          </>
        )}
        <button type="submit" style={{ padding: '10px 14px', borderRadius: 8, border: 0, background: '#2563eb', color: '#fff' }}>{mode === 'login' ? 'Sign In' : 'Register'}</button>
      </form>
      <div style={{ textAlign: 'center', marginTop: 14 }}>
        {mode === 'login' ? (
          <>Don't have an account? <button type="button" style={{ color: '#2563eb', background: 'none', border: 0, cursor: 'pointer' }} onClick={() => setMode('register')}>Register</button></>
        ) : (
          <>Already have an account? <button type="button" style={{ color: '#2563eb', background: 'none', border: 0, cursor: 'pointer' }} onClick={() => setMode('login')}>Sign In</button></>
        )}
      </div>
      {error && <p style={{ textAlign: 'center', padding: 8, color: 'red' }}>{error}</p>}
    </div>
  );
}

export default App;
