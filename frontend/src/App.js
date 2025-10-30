import React, { useState } from 'react';

const API_URL = 'http://localhost:5050/api/auth';

function App() {
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [currentUser, setCurrentUser] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      let url = mode === 'register' ? `${API_URL}/register` : `${API_URL}/login`;
      let body =
        mode === 'register'
          ? { username, email, password }
          : { identifier, password };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Unknown error');
        return;
      }
      setToken(data.token);
      setCurrentUser(data.user);
      localStorage.setItem('token', data.token);
      setUsername('');
      setEmail('');
      setPassword('');
      setIdentifier('');
    } catch (err) {
      setError('Network error');
    }
  };

  const handleLogout = () => {
    setToken('');
    setCurrentUser(null);
    localStorage.removeItem('token');
  };

  // Fetch user if token is present but user not loaded
  React.useEffect(() => {
    const getMe = async () => {
      if (token && !currentUser) {
        try {
          const res = await fetch(`${API_URL}/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          if (res.ok && data.user) {
            setCurrentUser(data.user);
          } else {
            handleLogout();
          }
        } catch {
          handleLogout();
        }
      }
    };
    getMe();
    // eslint-disable-next-line
  }, [token]);

  if (token && currentUser) {
    return (
      <div style={{ maxWidth: 360, margin: '2rem auto', padding: 32, border: '1px solid #dedede', borderRadius: 10, textAlign: 'center' }}>
        <h2>Welcome, {currentUser.username}!</h2>
        <div style={{ fontSize: 14, color: '#888' }}>{currentUser.email}</div>
        <button style={{ marginTop: 20 }} onClick={handleLogout}>Logout</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 360, margin: '2rem auto', padding: 32, border: '1px solid #dedede', borderRadius: 10 }}>
      <h2 style={{ textAlign: 'center' }}>{mode === 'login' ? 'Sign In' : 'Register'}</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {mode === 'register' ? (
          <>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Username"
              required
            />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email"
              required
            />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              required
            />
          </>
        ) : (
          <>
            <input
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              placeholder="Username or Email"
              required
            />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              required
            />
          </>
        )}
        <button type="submit">{mode === 'login' ? 'Sign In' : 'Register'}</button>
      </form>
      <p style={{ textAlign: 'center', padding: 8, color: 'red' }}>{error}</p>
      <div style={{ textAlign: 'center', marginTop: 14 }}>
        {mode === 'login' ? (
          <>
            Don't have an account?{' '}
            <button type="button" style={{ color: 'blue', background: 'none', border: 0, cursor: 'pointer' }} onClick={() => setMode('register')}>Register</button>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <button type="button" style={{ color: 'blue', background: 'none', border: 0, cursor: 'pointer' }} onClick={() => setMode('login')}>Sign In</button>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
