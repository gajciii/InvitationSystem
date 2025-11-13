import React, { useState } from 'react';

const AUTH_URL = 'http://localhost:5050/api/auth';
const INV_URL = 'http://localhost:5050/api/invitations';
const RESPONSE_TOKEN_PREFIX = 'invitation-response-';

function useQuery() {
  const [query] = useState(() => new URLSearchParams(window.location.search));
  return query;
}

function getShareUrl(id) {
  return `${window.location.origin}/?invitation=${id}`;
}

const combineDateAndTime = (dateValue, timeValue) => {
  if (!dateValue && !timeValue) return null;
  if (!dateValue) return null;
  if (!timeValue) return new Date(dateValue);
  return new Date(`${dateValue}T${timeValue}`);
};

const toDateInputValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toTimeInputValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const formatDateTime = (value) => {
  if (!value) return 'Ni datuma';
  return new Date(value).toLocaleString();
};

const prettyStatus = (status) => {
  if (!status) return '';
  switch (status) {
    case 'attending':
      return 'Coming';
    case 'not_attending':
      return 'Not coming';
    case 'maybe':
      return 'Maybe';
    default:
      return status;
  }
};

const statusBadgeColor = (status) => {
  switch (status) {
    case 'attending':
      return '#22c55e';
    case 'maybe':
      return '#f97316';
    case 'not_attending':
      return '#ef4444';
    default:
      return '#64748b';
  }
};

const responseTokenKey = (invitationId) => `${RESPONSE_TOKEN_PREFIX}${invitationId}`;

const readStoredResponseToken = (invitationId) => {
  if (!invitationId || typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(responseTokenKey(invitationId)) || '';
  } catch {
    return '';
  }
};

const persistResponseToken = (invitationId, tokenValue) => {
  if (!invitationId || typeof window === 'undefined') return;
  const key = responseTokenKey(invitationId);
  try {
    if (!tokenValue) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, tokenValue);
    }
  } catch {
    // ignore storage failures
  }
};

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
  const [cutoffDate, setCutoffDate] = useState('');
  const [cutoffTime, setCutoffTime] = useState('');
  const [createdInvitationId, setCreatedInvitationId] = useState('');

  // Public invitation view
  const [publicInvitation, setPublicInvitation] = useState(null);
  const [publicCanEdit, setPublicCanEdit] = useState(true);
  const [myResponse, setMyResponse] = useState(null);
  const [responseToken, setResponseToken] = useState(() => readStoredResponseToken(invitationIdFromUrl));
  const [rsvpStatus, setRsvpStatus] = useState('attending');
  const [rsvpNotes, setRsvpNotes] = useState('');
  const [rsvpSaved, setRsvpSaved] = useState('');
  const [savingRsvp, setSavingRsvp] = useState(false);

  // Owner dashboard
  const [myInvitations, setMyInvitations] = useState([]);
  const [managedInvitation, setManagedInvitation] = useState(null);
  const [ownerPanel, setOwnerPanel] = useState('create'); // create | edit | responses
  const [myResponses, setMyResponses] = useState([]);
  const [myResponsesError, setMyResponsesError] = useState('');

  // Edit invitation form
  const [editTitle, setEditTitle] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editRsvpLink, setEditRsvpLink] = useState('');
  const [editCutoffDate, setEditCutoffDate] = useState('');
  const [editCutoffTime, setEditCutoffTime] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editSuccess, setEditSuccess] = useState('');

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

  const handleLogout = () => {
    setToken('');
    setCurrentUser(null);
    localStorage.removeItem('token');
    setMyInvitations([]);
    setManagedInvitation(null);
    setOwnerPanel('create');
    setMyResponses([]);
    setMyResponsesError('');
  };

  const refreshMyResponses = React.useCallback(async () => {
    if (!currentUser || !token) {
      setMyResponses([]);
      setMyResponsesError('');
      return;
    }
    try {
      const res = await fetch(`${INV_URL}/my/responses`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) {
        setMyResponses([]);
        setMyResponsesError(data.error || 'Failed to load responses');
        return;
      }
      const mapped = (data || []).map((item) => ({
        invitationId: item._id,
        title: item.title,
        dateTime: item.dateTime,
        location: item.location,
        responseCutoff: item.responseCutoff,
        status: item.response?.status || 'attending',
        notes: item.response?.notes || '',
        updatedAt: item.response?.updatedAt || null,
        canEdit: item.response?.canEdit !== false,
        draftStatus: item.response?.status || 'attending',
        draftNotes: item.response?.notes || '',
        saving: false,
        message: '',
        responseError: '',
      }));
      setMyResponses(mapped);
      setMyResponsesError('');
    } catch {
      setMyResponses([]);
      setMyResponsesError('Failed to load responses');
    }
  }, [currentUser, token]);

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

  // Update stored response token when invitation query changes
  React.useEffect(() => {
    if (!invitationIdFromUrl) {
      setResponseToken('');
      return;
    }
    setResponseToken(readStoredResponseToken(invitationIdFromUrl));
  }, [invitationIdFromUrl]);

  // Load public invitation if query has id
  React.useEffect(() => {
    const loadInvitation = async () => {
      if (!invitationIdFromUrl) {
        setPublicInvitation(null);
        return;
      }
      try {
        const headers = {};
        if (responseToken) headers['X-Response-Token'] = responseToken;
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(`${INV_URL}/${invitationIdFromUrl}`, { headers });
        const data = await res.json();
        if (res.ok) {
          setPublicInvitation(data);
          setPublicCanEdit(data.canEditResponse !== false);
          setMyResponse(data.myResponse);
          setRsvpStatus(data.myResponse?.status || 'attending');
          setRsvpNotes(data.myResponse?.notes || '');
          setRsvpSaved('');
        }
      } catch {
        setPublicInvitation(null);
      }
    };
    loadInvitation();
  }, [invitationIdFromUrl, responseToken, token]);

  // After login, load my invitations and keep current selection if possible
  React.useEffect(() => {
    const loadMine = async () => {
      if (!currentUser || !token) return;
      try {
        const res = await fetch(`${INV_URL}`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (res.ok) {
          setMyInvitations(data);
          setManagedInvitation((prev) => {
            if (!prev) return data[0] || null;
            const stillExists = data.find((item) => item._id === prev._id);
            return stillExists || data[0] || null;
          });
        }
      } catch {}
    };
    loadMine();
  }, [currentUser, token]);

  React.useEffect(() => {
    refreshMyResponses();
  }, [refreshMyResponses]);

  // Hydrate edit form when selection changes
  React.useEffect(() => {
    if (!managedInvitation) {
      setEditTitle('');
      setEditMessage('');
      setEditDate('');
      setEditTime('');
      setEditLocation('');
      setEditRsvpLink('');
      setEditCutoffDate('');
      setEditCutoffTime('');
      setEditSuccess('');
      return;
    }
    setEditTitle(managedInvitation.title || '');
    setEditMessage(managedInvitation.message || '');
    setEditDate(toDateInputValue(managedInvitation.dateTime));
    setEditTime(toTimeInputValue(managedInvitation.dateTime));
    setEditLocation(managedInvitation.location || '');
    setEditRsvpLink(managedInvitation.rsvpLink || '');
    setEditCutoffDate(toDateInputValue(managedInvitation.responseCutoff));
    setEditCutoffTime(toTimeInputValue(managedInvitation.responseCutoff));
    setEditSuccess('');
  }, [managedInvitation]);

  const createInvitation = async () => {
    setError('');
    const eventDateTime = combineDateAndTime(date, time);
    const cutoffDateTime = combineDateAndTime(cutoffDate, cutoffTime);
    try {
      const res = await fetch(INV_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title,
          message,
          dateTime: eventDateTime ? eventDateTime.toISOString() : null,
          location,
          rsvpLink,
          responseCutoff: cutoffDateTime ? cutoffDateTime.toISOString() : null
        })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to create'); return; }
      setCreatedInvitationId(data._id);
      setMyInvitations(prev => [data, ...prev]);
      setManagedInvitation(data);
      setOwnerPanel('responses');
      setTitle(''); setMessage(''); setDate(''); setTime(''); setLocation(''); setRsvpLink(''); setCutoffDate(''); setCutoffTime('');
    } catch { setError('Network error'); }
  };

  const updateInvitation = async () => {
    if (!managedInvitation) return;
    setError('');
    setEditSuccess('');
    setEditSaving(true);
    const eventDateTime = combineDateAndTime(editDate, editTime);
    const cutoffDateTime = combineDateAndTime(editCutoffDate, editCutoffTime);
    try {
      const res = await fetch(`${INV_URL}/${managedInvitation._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: editTitle,
          message: editMessage,
          dateTime: eventDateTime ? eventDateTime.toISOString() : null,
          location: editLocation,
          rsvpLink: editRsvpLink,
          responseCutoff: cutoffDateTime ? cutoffDateTime.toISOString() : null
        })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to update invitation'); return; }
      setManagedInvitation(data);
      setMyInvitations(prev => prev.map(inv => inv._id === data._id ? data : inv));
      setEditSuccess('Changes saved');
    } catch {
      setError('Network error');
    } finally {
      setEditSaving(false);
    }
  };

  const updateMyResponseDraft = (invitationId, field, value) => {
    const key = field === 'status' ? 'draftStatus' : 'draftNotes';
    setMyResponses((prev) =>
      prev.map((item) =>
        item.invitationId === invitationId
          ? { ...item, [key]: value, message: '', responseError: '' }
          : item
      )
    );
  };

  const saveMyResponse = async (invitationId) => {
    if (!token) return;
    const target = myResponses.find((item) => item.invitationId === invitationId);
    if (!target || !target.canEdit || target.saving) return;
    const payload = { status: target.draftStatus, notes: target.draftNotes };
    setMyResponses((prev) =>
      prev.map((item) =>
        item.invitationId === invitationId ? { ...item, saving: true, responseError: '', message: '' } : item
      )
    );
    try {
      const res = await fetch(`${INV_URL}/${invitationId}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update response');
      }
      setMyResponses((prev) =>
        prev.map((item) =>
          item.invitationId === invitationId
            ? {
                ...item,
                status: payload.status,
                notes: payload.notes,
                updatedAt: data.updatedAt || new Date().toISOString(),
                saving: false,
                message: data.mode === 'updated' ? 'Response updated' : 'Response saved',
                responseError: ''
              }
            : item
        )
      );
    } catch (err) {
      setMyResponses((prev) =>
        prev.map((item) =>
          item.invitationId === invitationId
            ? { ...item, saving: false, responseError: err.message || 'Failed to update response' }
            : item
        )
      );
    }
  };

  const submitRsvp = async () => {
    if (!publicInvitation) return;
    if (!publicCanEdit) { setError('RSVP window is closed'); return; }
    setError('');
    setSavingRsvp(true);
    setRsvpSaved('');
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (responseToken) headers['X-Response-Token'] = responseToken;
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${INV_URL}/${publicInvitation._id}/rsvp`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ status: rsvpStatus, notes: rsvpNotes })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to submit RSVP'); return; }
      if (typeof data.responseToken !== 'undefined') {
        persistResponseToken(publicInvitation._id, data.responseToken);
        setResponseToken(data.responseToken || '');
      }
      setMyResponse({ _id: data.responseId, status: rsvpStatus, notes: rsvpNotes, updatedAt: data.updatedAt });
      setRsvpSaved(data.mode === 'updated' ? 'Response updated' : 'Response submitted');
      if (token) {
        refreshMyResponses();
      }
    } catch {
      setError('Network error');
    } finally {
      setSavingRsvp(false);
    }
  };

  const ownerResponseCounts = React.useMemo(() => {
    const counts = { attending: 0, maybe: 0, not_attending: 0 };
    (managedInvitation?.responses || []).forEach((resp) => {
      counts[resp.status] = (counts[resp.status] || 0) + 1;
    });
    return counts;
  }, [managedInvitation]);

  const renderOwnerTabNav = () => (
    <div style={{ display: 'flex', borderBottom: '1px solid #eee' }}>
      {[
        { id: 'create', label: 'Nova' },
        { id: 'edit', label: 'Uredi' },
        { id: 'responses', label: 'Odgovori' }
      ].map(tab => {
        const disabled = (tab.id !== 'create') && !managedInvitation;
        return (
          <button
            key={tab.id}
            onClick={() => !disabled && setOwnerPanel(tab.id)}
            disabled={disabled}
            style={{
              flex: 1,
              padding: '10px 0',
              border: 'none',
              borderBottom: ownerPanel === tab.id ? '3px solid #2563eb' : '3px solid transparent',
              background: 'none',
              fontWeight: ownerPanel === tab.id ? 700 : 500,
              color: disabled ? '#bbb' : '#111',
              cursor: disabled ? 'default' : 'pointer'
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );

  const renderCreatePanel = () => (
    <div style={{ padding: 16 }}>
      <div style={{ fontWeight: 700, marginBottom: 10 }}>Create Invitation</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, maxWidth: 520 }}>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
        <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Message" rows={4} style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
          <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="date" value={cutoffDate} onChange={e => setCutoffDate(e.target.value)} placeholder="RSVP cutoff date" style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
          <input type="time" value={cutoffTime} onChange={e => setCutoffTime(e.target.value)} placeholder="RSVP cutoff time" style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
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
  );

  const renderEditPanel = () => (
    <div style={{ padding: 16 }}>
      {!managedInvitation && <div style={{ color: '#888' }}>Select an invitation to edit</div>}
      {managedInvitation && (
        <>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Edit Invitation</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, maxWidth: 520 }}>
            <input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Title" style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
            <textarea value={editMessage} onChange={e => setEditMessage(e.target.value)} placeholder="Message" rows={4} style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
              <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="date" value={editCutoffDate} onChange={e => setEditCutoffDate(e.target.value)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
              <input type="time" value={editCutoffTime} onChange={e => setEditCutoffTime(e.target.value)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
            </div>
            <input value={editLocation} onChange={e => setEditLocation(e.target.value)} placeholder="Location" style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
            <input value={editRsvpLink} onChange={e => setEditRsvpLink(e.target.value)} placeholder="RSVP Link (optional)" style={{ padding: 10, borderRadius: 8, border: '1px solid #ddd' }} />
            <button onClick={updateInvitation} disabled={editSaving} style={{ padding: '10px 14px', borderRadius: 8, border: 0, color: '#fff', background: editSaving ? '#93c5fd' : '#2563eb' }}>
              {editSaving ? 'Saving...' : 'Save changes'}
            </button>
            {editSuccess && <div style={{ color: '#22c55e' }}>{editSuccess}</div>}
          </div>
        </>
      )}
    </div>
  );

  const renderResponsesPanel = () => (
    <div style={{ padding: 16 }}>
      {!managedInvitation && <div style={{ color: '#888' }}>Select an invitation to view Odgovori</div>}
      {managedInvitation && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 700 }}>{managedInvitation.title}</div>
              <div style={{ fontSize: 12, color: '#666' }}>{formatDateTime(managedInvitation.dateTime)}</div>
            </div>
            <div style={{ fontSize: 12, color: '#666' }}>{managedInvitation.responses?.length || 0} responses total</div>
          </div>
          <div style={{ marginTop: 10, fontSize: 12 }}>
            Share: <a href={getShareUrl(managedInvitation._id)}>{getShareUrl(managedInvitation._id)}</a>
            <button onClick={() => navigator.clipboard.writeText(getShareUrl(managedInvitation._id))} style={{ marginLeft: 8, padding: '2px 6px', fontSize: 12 }}>Copy</button>
          </div>
          {managedInvitation.responseCutoff && (
            <div style={{ marginTop: 8, fontSize: 13, color: '#2563eb' }}>
              RSVP cutoff: {new Date(managedInvitation.responseCutoff).toLocaleString()}
            </div>
          )}
          <div style={{ marginTop: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 12, color: '#15803d' }}>Coming</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{ownerResponseCounts.attending}</div>
            </div>
            <div style={{ background: '#fffbeb', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 12, color: '#c2410c' }}>Maybe</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{ownerResponseCounts.maybe}</div>
            </div>
            <div style={{ background: '#fef2f2', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 12, color: '#b91c1c' }}>Not coming</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{ownerResponseCounts.not_attending}</div>
            </div>
          </div>
          {(managedInvitation.responses || []).length === 0 && <div style={{ color: '#888', marginTop: 16 }}>No responses yet</div>}
          {(managedInvitation.responses || []).length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.9fr 1.2fr 0.8fr', gap: 12, fontSize: 12, color: '#666', paddingBottom: 6, borderBottom: '1px solid #eee' }}>
                <div>Name</div>
                <div>Status</div>
                <div>Notes</div>
                <div>Updated</div>
              </div>
              {(managedInvitation.responses || []).map((r, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.9fr 1.2fr 0.8fr', gap: 12, padding: '10px 0', borderBottom: '1px solid #f0f0f0', alignItems: 'center' }}>
                  <div style={{ fontWeight: 500 }}>{r.name || 'Anonimno'}</div>
                  <div>
                    <span style={{ padding: '4px 8px', borderRadius: 999, fontSize: 12, background: statusBadgeColor(r.status) + '22', color: statusBadgeColor(r.status) }}>
                      {prettyStatus(r.status)}
                    </span>
                  </div>
                  <div>{r.notes || '-'}</div>
                  <div style={{ fontSize: 12, color: '#999' }}>{r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '-'}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

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
        <div style={{ maxWidth: 520, margin: '3rem auto', padding: 24, border: '1px solid #e6e6e6', borderRadius: 12, textAlign: 'center', boxShadow: '0 6px 18px rgba(0,0,0,0.06)' }}>
          <h2 style={{ margin: 0 }}>{publicInvitation.title}</h2>
          {publicInvitation.dateTime && (<div style={{ fontSize: 13, color: '#666', marginTop: 6 }}>{new Date(publicInvitation.dateTime).toLocaleString()}</div>)}
          {publicInvitation.location && (<div style={{ fontSize: 13, color: '#666', marginTop: 2 }}>{publicInvitation.location}</div>)}
          {publicInvitation.message && (<p style={{ marginTop: 14 }}>{publicInvitation.message}</p>)}
          {publicInvitation.responseCutoff && (
            <div style={{ marginTop: 12, fontSize: 12, color: publicCanEdit ? '#2563eb' : '#b91c1c' }}>
              RSVP cutoff: {new Date(publicInvitation.responseCutoff).toLocaleString()}
            </div>
          )}
          <div style={{ marginTop: 16, textAlign: 'left' }}>
            <div style={{ marginBottom: 6, fontWeight: 600 }}>Odgovori</div>
            {!publicCanEdit && (
              <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 8 }}>
                RSVP changes are closed for this invitation.
              </div>
            )}
            <select value={rsvpStatus} onChange={e => setRsvpStatus(e.target.value)} disabled={!publicCanEdit} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd' }}>
              <option value="attending">Attending</option>
              <option value="maybe">Maybe</option>
              <option value="not_attending">Not attending</option>
            </select>
            <textarea value={rsvpNotes} onChange={e => setRsvpNotes(e.target.value)} disabled={!publicCanEdit} placeholder="Additional notes" style={{ width: '100%', padding: 10, marginTop: 8, borderRadius: 8, border: '1px solid #ddd', minHeight: 80 }} />
            <button onClick={submitRsvp} disabled={!publicCanEdit || savingRsvp} style={{ marginTop: 10, padding: '10px 16px', background: publicCanEdit ? '#2563eb' : '#94a3b8', color: '#fff', border: 0, borderRadius: 8 }}>
              {savingRsvp ? 'Saving...' : myResponse ? 'Update RSVP' : 'Submit RSVP'}
            </button>
            {rsvpSaved && <div style={{ color: '#16a34a', marginTop: 8 }}>{rsvpSaved}</div>}
            {myResponse && (
              <div style={{ marginTop: 10, fontSize: 12, color: '#666' }}>
                Last updated: {myResponse.updatedAt ? new Date(myResponse.updatedAt).toLocaleString() : 'just now'}
              </div>
            )}
          </div>
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
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, color: '#777' }}>{currentUser.email}</span>
              <button onClick={handleLogout} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #ddd', background: '#fff' }}>Logout</button>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 960, margin: '1.5rem auto', display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
          {/* Left: My Invitations */}
          <div id="my" style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, height: 'fit-content' }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>My Invitations</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {myInvitations.map((inv) => (
                <div key={inv._id} style={{ border: '1px solid #e6e6e6', borderRadius: 10, padding: 10, background: managedInvitation?._id === inv._id ? '#eef2ff' : '#fff' }}>
                  <button onClick={() => setManagedInvitation(inv)} style={{ textAlign: 'left', width: '100%', background: 'transparent', border: 0, cursor: 'pointer' }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{inv.title}</div>
                    <div style={{ fontSize: 12, color: '#777' }}>{inv.dateTime ? new Date(inv.dateTime).toLocaleString() : 'No date'}</div>
                  </button>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 6 }}>
                    <span>{inv.responses?.length || 0} responses</span>
                    <button onClick={() => { setManagedInvitation(inv); setOwnerPanel('responses'); }} style={{ border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer', padding: 0 }}>
                      Odgovori
                    </button>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12 }}>
                    Link: <a href={getShareUrl(inv._id)}>{getShareUrl(inv._id)}</a>
                    <button onClick={() => navigator.clipboard.writeText(getShareUrl(inv._id))} style={{ marginLeft: 8, padding: '2px 6px', fontSize: 12 }}>Copy</button>
                  </div>
                </div>
              ))}
              {myInvitations.length === 0 && <div style={{ color: '#888' }}>No invitations yet</div>}
            </div>
            <div style={{ borderTop: '1px solid #f5f5f5', margin: '16px 0' }} />
            <div style={{ fontWeight: 700, marginBottom: 4 }}>My Responses</div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>Events you have responded to</div>
            {myResponsesError && <div style={{ color: '#b91c1c', fontSize: 12, marginBottom: 8 }}>{myResponsesError}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {myResponses.map((resp) => {
                const saveDisabled = !resp.canEdit || resp.saving || (resp.draftStatus === resp.status && resp.draftNotes === resp.notes);
                return (
                  <div key={resp.invitationId} style={{ border: '1px solid #f0f0f0', borderRadius: 10, padding: 10, background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{resp.title}</div>
                        <div style={{ fontSize: 12, color: '#777' }}>{formatDateTime(resp.dateTime)}</div>
                      </div>
                      <div style={{ fontSize: 12, textAlign: 'right' }}>
                        <div style={{ color: '#666' }}>Current</div>
                        <span style={{ padding: '3px 8px', borderRadius: 999, background: statusBadgeColor(resp.status) + '22', color: statusBadgeColor(resp.status) }}>
                          {prettyStatus(resp.status)}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <select
                        value={resp.draftStatus}
                        onChange={e => updateMyResponseDraft(resp.invitationId, 'status', e.target.value)}
                        disabled={!resp.canEdit || resp.saving}
                        style={{ flex: 0.85, padding: 10, borderRadius: 8, border: '1px solid #ddd' }}
                      >
                        <option value="attending">Attending</option>
                        <option value="maybe">Maybe</option>
                        <option value="not_attending">Not attending</option>
                      </select>
                      <button
                        onClick={() => { window.location.href = getShareUrl(resp.invitationId); }}
                        style={{ flex: 0.15, minWidth: 80, padding: '10px 8px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', fontSize: 12 }}
                      >
                        Open
                      </button>
                    </div>
                    <textarea
                      value={resp.draftNotes}
                      onChange={e => updateMyResponseDraft(resp.invitationId, 'notes', e.target.value)}
                      disabled={!resp.canEdit || resp.saving}
                      placeholder="Notes"
                      style={{ width: '100%', padding: 10, marginTop: 8, borderRadius: 8, border: '1px solid #ddd', minHeight: 70 }}
                    />
                    <button
                      onClick={() => saveMyResponse(resp.invitationId)}
                      disabled={saveDisabled}
                      style={{ marginTop: 8, width: '100%', padding: '8px 12px', borderRadius: 8, border: 0, color: '#fff', background: saveDisabled ? '#93c5fd' : '#2563eb' }}
                    >
                      {resp.saving ? 'Saving...' : 'Save response'}
                    </button>
                    {resp.responseCutoff && (
                      <div style={{ marginTop: 6, fontSize: 11, color: resp.canEdit ? '#2563eb' : '#b91c1c' }}>
                        RSVP cutoff: {new Date(resp.responseCutoff).toLocaleString()}
                      </div>
                    )}
                    {!resp.canEdit && (
                      <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 2 }}>Changes are closed for this event.</div>
                    )}
                    {resp.message && <div style={{ color: '#16a34a', fontSize: 12, marginTop: 6 }}>{resp.message}</div>}
                    {resp.responseError && <div style={{ color: '#b91c1c', fontSize: 12, marginTop: 6 }}>{resp.responseError}</div>}
                    {resp.updatedAt && (
                      <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>Updated: {new Date(resp.updatedAt).toLocaleString()}</div>
                    )}
                  </div>
                );
              })}
              {!myResponsesError && myResponses.length === 0 && <div style={{ color: '#888' }}>You have not responded yet</div>}
            </div>
          </div>

          {/* Right: Panels */}
          <div style={{ border: '1px solid #eee', borderRadius: 12, background: '#fff' }}>
            {renderOwnerTabNav()}
            {ownerPanel === 'create' && renderCreatePanel()}
            {ownerPanel === 'edit' && renderEditPanel()}
            {ownerPanel === 'responses' && renderResponsesPanel()}
          </div>
        </div>
        {error && <div style={{ textAlign: 'center', marginTop: 10, color: 'red' }}>{error}</div>}
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
