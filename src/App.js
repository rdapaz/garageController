import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Loader, AlertTriangle, X, Plus, Trash2, Car, Clock, LogIn, LogOut, Lock, Sun, Moon, ShieldCheck, ShieldOff, Timer } from 'lucide-react';

// Custom garage door icons (stroke-based, matches Lucide style)
function GarageOpen({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Garage frame */}
      <path d="M3 21V8l9-5 9 5v13" />
      {/* Opening / floor line */}
      <line x1="3" y1="21" x2="21" y2="21" />
      {/* Rolled-up door panels at top */}
      <path d="M6 8h12" />
      <path d="M6 10.5h12" />
      {/* Side walls */}
      <line x1="6" y1="8" x2="6" y2="21" />
      <line x1="18" y1="8" x2="18" y2="21" />
      {/* Car silhouette inside */}
      <path d="M8 18h8M9 16h6l1 2H8l1-2z" />
    </svg>
  );
}

function GarageClosed({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Garage frame */}
      <path d="M3 21V8l9-5 9 5v13" />
      {/* Floor line */}
      <line x1="3" y1="21" x2="21" y2="21" />
      {/* Door panels */}
      <line x1="6" y1="9" x2="18" y2="9" />
      <line x1="6" y1="12" x2="18" y2="12" />
      <line x1="6" y1="15" x2="18" y2="15" />
      <line x1="6" y1="18" x2="18" y2="18" />
      {/* Side walls */}
      <line x1="6" y1="8" x2="6" y2="21" />
      <line x1="18" y1="8" x2="18" y2="21" />
      {/* Door handle */}
      <circle cx="16" cy="16.5" r="0.5" fill="currentColor" />
    </svg>
  );
}

// Configure axios interceptor for auth
const getToken = () => localStorage.getItem('garage_token');

axios.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('garage_token');
      window.dispatchEvent(new Event('auth-expired'));
    }
    return Promise.reject(error);
  }
);

function LoginForm({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await axios.post('/api/auth/login', { username, password });
      localStorage.setItem('garage_token', response.data.token);
      onLogin(response.data.username);
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed');
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 shadow sm:rounded-lg mt-6">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center mb-4">
          <Lock className="h-5 w-5 text-indigo-500 mr-2" />
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">Sign In</h3>
        </div>
        {error && (
          <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm"
            required
            autoComplete="username"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm"
            required
            autoComplete="current-password"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 disabled:bg-gray-400"
          >
            {loading ? <Loader className="animate-spin h-5 w-5" /> : <><LogIn className="h-4 w-4 mr-2" /> Sign In</>}
          </button>
        </div>
      </div>
    </form>
  );
}

function EventList({ events }) {
  const formatEventTime = (timestamp) => {
    const utcTimestamp = timestamp.endsWith('Z') ? timestamp : timestamp + 'Z';
    return new Date(utcTimestamp).toLocaleString('en-AU', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg mt-6">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
          Recent Events
        </h3>
        {events.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No events recorded yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {events.map((event, index) => (
              <li key={index} className="py-3 flex items-center justify-between">
                <div className="flex items-center">
                  {event[0] === 'Open' ? (
                    <GarageOpen className="h-5 w-5 text-green-400 mr-3" />
                  ) : (
                    <GarageClosed className="h-5 w-5 text-red-400 mr-3" />
                  )}
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-200">
                    Garage {event[0]}
                  </span>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {formatEventTime(event[1])}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function LPRNotification({ countdown, plate, onCancel, isAuthenticated }) {
  if (countdown <= 0) return null;

  return (
    <div className="fixed top-4 right-4 max-w-sm w-full bg-yellow-50 dark:bg-yellow-900/40 border-l-4 border-yellow-400 p-4 shadow-lg rounded-lg z-50 animate-pulse">
      <div className="flex">
        <div className="flex-shrink-0">
          <AlertTriangle className="h-5 w-5 text-yellow-400" />
        </div>
        <div className="ml-3 flex-1">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            Auto-closing in {countdown} seconds
          </p>
          <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
            Detected: {plate}
          </p>
          {isAuthenticated && (
            <button
              onClick={onCancel}
              className="mt-2 text-xs font-medium text-yellow-800 dark:text-yellow-200 hover:text-yellow-900 dark:hover:text-yellow-100 underline"
            >
              Cancel auto-close
            </button>
          )}
        </div>
        {isAuthenticated && (
          <div className="ml-3 flex-shrink-0">
            <button
              onClick={onCancel}
              className="inline-flex text-yellow-400 hover:text-yellow-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function LPRManagement({ isAuthenticated }) {
  const [plates, setPlates] = useState([]);
  const [newPlate, setNewPlate] = useState('');
  const [newOwner, setNewOwner] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchPlates = useCallback(async () => {
    try {
      const response = await axios.get('/api/lpr/plates');
      setPlates(response.data.plates);
    } catch (error) {
      console.error('Error fetching plates:', error);
    }
  }, []);

  useEffect(() => {
    fetchPlates();
  }, [fetchPlates, isAuthenticated]);

  const addPlate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post('/api/lpr/plates', {
        plate_number: newPlate.toUpperCase(),
        owner_name: newOwner
      });
      setNewPlate('');
      setNewOwner('');
      setShowForm(false);
      fetchPlates();
    } catch (error) {
      alert(error.response?.data?.detail || 'Error adding plate');
    }
    setLoading(false);
  };

  const removePlate = async (plate) => {
    if (!window.confirm(`Remove plate ${plate}?`)) return;
    try {
      await axios.delete(`/api/lpr/plates/${plate}`);
      fetchPlates();
    } catch (error) {
      alert('Error removing plate');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg mt-6">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
            Authorized Plates
          </h3>
          {isAuthenticated && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Plate
            </button>
          )}
        </div>

        {showForm && isAuthenticated && (
          <form onSubmit={addPlate} className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Plate Number"
                value={newPlate}
                onChange={(e) => setNewPlate(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-600 dark:text-white rounded-md text-sm"
                required
              />
              <input
                type="text"
                placeholder="Owner Name"
                value={newOwner}
                onChange={(e) => setNewOwner(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-600 dark:text-white rounded-md text-sm"
              />
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 disabled:bg-gray-400"
              >
                {loading ? 'Adding...' : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm rounded-md hover:bg-gray-400 dark:hover:bg-gray-500"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {plates.filter(p => p.active).map((plate, index) => (
            <li key={index} className="py-3 flex items-center justify-between">
              <div className="flex items-center">
                <Car className="h-5 w-5 text-indigo-400 mr-3" />
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-200">{plate.plate}</span>
                  {plate.owner && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">({plate.owner})</span>
                  )}
                </div>
              </div>
              {isAuthenticated && (
                <button
                  onClick={() => removePlate(plate.plate)}
                  className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
          {plates.filter(p => p.active).length === 0 && (
            <li className="py-3 text-sm text-gray-500 dark:text-gray-400">No authorized plates yet</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function SettingsPanel({ isAuthenticated }) {
  const [autoCloseMin, setAutoCloseMin] = useState(10);
  const [lprCloseSec, setLprCloseSec] = useState(60);
  const [showSettings, setShowSettings] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get('/api/settings').then(res => {
      setAutoCloseMin(res.data.auto_close_minutes);
      setLprCloseSec(res.data.lpr_close_seconds);
    }).catch(() => {});
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await axios.post('/api/settings', {
        auto_close_minutes: autoCloseMin,
        lpr_close_seconds: lprCloseSec
      });
      setAutoCloseMin(res.data.auto_close_minutes);
      setLprCloseSec(res.data.lpr_close_seconds);
    } catch (error) {
      alert('Error saving settings');
    }
    setSaving(false);
  };

  if (!isAuthenticated) return null;

  return (
    <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg mt-6">
      <div className="px-4 py-5 sm:p-6">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center justify-between w-full"
        >
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
            Timer Settings
          </h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">{showSettings ? 'Hide' : 'Show'}</span>
        </button>

        {showSettings && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="flex justify-between text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <span>Safety Auto-Close</span>
                <span className="text-indigo-600 dark:text-indigo-400">{autoCloseMin} min</span>
              </label>
              <input
                type="range"
                min="1"
                max="30"
                value={autoCloseMin}
                onChange={(e) => setAutoCloseMin(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>1 min</span>
                <span>30 min</span>
              </div>
            </div>

            <div>
              <label className="flex justify-between text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <span>LPR Auto-Close Delay</span>
                <span className="text-indigo-600 dark:text-indigo-400">{lprCloseSec} sec</span>
              </label>
              <input
                type="range"
                min="10"
                max="300"
                step="10"
                value={lprCloseSec}
                onChange={(e) => setLprCloseSec(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>10 sec</span>
                <span>5 min</span>
              </div>
            </div>

            <button
              onClick={saveSettings}
              disabled={saving}
              className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white text-sm font-medium rounded-md disabled:bg-gray-400"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function LogViewer({ isAuthenticated }) {
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/logs?lines=50');
      setLogs(res.data.logs);
    } catch (error) {
      setLogs(['Error fetching logs']);
    }
    setLoading(false);
  };

  if (!isAuthenticated) return null;

  return (
    <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg mt-6">
      <div className="px-4 py-5 sm:p-6">
        <button
          onClick={() => { setShowLogs(!showLogs); if (!showLogs) fetchLogs(); }}
          className="flex items-center justify-between w-full"
        >
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
            System Logs
          </h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">{showLogs ? 'Hide' : 'Show'}</span>
        </button>

        {showLogs && (
          <div className="mt-4">
            <div className="flex justify-end mb-2">
              <button
                onClick={fetchLogs}
                disabled={loading}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
              >
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
            <div className="bg-gray-900 dark:bg-black rounded-lg p-3 max-h-64 overflow-y-auto">
              {logs.map((line, i) => (
                <div key={i} className="text-xs font-mono text-green-400 leading-5 whitespace-pre-wrap break-all">
                  {line}
                </div>
              ))}
              {logs.length === 0 && (
                <div className="text-xs text-gray-500">No logs available</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [status, setStatus] = useState('Unknown');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [countdown, setCountdown] = useState(0);
  const [pendingPlate, setPendingPlate] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  const [autoCloseCountdown, setAutoCloseCountdown] = useState(0);
  const [doorOpenedAt, setDoorOpenedAt] = useState(null); // UTC ISO string from backend
  const [doorOpenDuration, setDoorOpenDuration] = useState('');

  // Dark mode: load saved preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
    setIsDarkMode(!isDarkMode);
  };

  // Check for existing token on load
  useEffect(() => {
    const token = getToken();
    if (token) {
      axios.get('/api/auth/verify')
        .then(res => {
          setIsAuthenticated(true);
          setUsername(res.data.username);
        })
        .catch(() => {
          localStorage.removeItem('garage_token');
          setIsAuthenticated(false);
        });
    }

    const handleAuthExpired = () => {
      setIsAuthenticated(false);
      setUsername('');
    };
    window.addEventListener('auth-expired', handleAuthExpired);
    return () => window.removeEventListener('auth-expired', handleAuthExpired);
  }, []);

  const handleLogin = (user) => {
    setIsAuthenticated(true);
    setUsername(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('garage_token');
    setIsAuthenticated(false);
    setUsername('');
  };

  const setupWebSocket = useCallback(() => {
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${wsProto}//${window.location.host}/ws`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'status_update') {
        setStatus(data.status);
        if (data.door_opened_at) {
          setDoorOpenedAt(data.door_opened_at);
        } else {
          setDoorOpenedAt(null);
          setDoorOpenDuration('');
        }
        if (data.events) {
          setEvents(data.events);
        }
        if (data.countdown !== undefined) {
          setCountdown(data.countdown);
        }
        if (data.pending_close_plate !== undefined) {
          setPendingPlate(data.pending_close_plate);
        }
        if (data.hold_open !== undefined) {
          setHoldOpen(data.hold_open);
        }
        if (data.auto_close_countdown !== undefined) {
          setAutoCloseCountdown(data.auto_close_countdown);
        }
        setLastUpdated(new Date());
      } else if (data.type === 'lpr_status') {
        if (data.data.action === 'countdown') {
          setCountdown(data.data.seconds_remaining);
          setPendingPlate(data.data.plate);
        } else if (data.data.action === 'cancelled' || data.data.action === 'cancelled_by_user') {
          setCountdown(0);
          setPendingPlate(null);
        } else if (data.data.action === 'safety_countdown') {
          setAutoCloseCountdown(data.data.seconds_remaining);
        } else if (data.data.action === 'safety_closed') {
          setAutoCloseCountdown(0);
        } else if (data.data.action === 'hold_open_changed') {
          setHoldOpen(data.data.hold_open);
        }
      }
    };

    ws.onclose = () => {
      console.log('WebSocket closed. Reconnecting...');
      setTimeout(setupWebSocket, 1000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send('ping');
      }
    }, 30000);

    return () => {
      clearInterval(interval);
      ws.close();
    };
  }, []);

  useEffect(() => {
    const cleanup = setupWebSocket();

    const fetchEvents = async () => {
      try {
        const response = await axios.get('/api/events');
        setEvents(response.data.events);
      } catch (error) {
        console.error('Error fetching events:', error);
      }
    };
    fetchEvents();

    return cleanup;
  }, [setupWebSocket]);

  const toggleGarage = async () => {
    setLoading(true);
    try {
      const response = await axios.post('/api/toggle');
      setStatus(response.data.status);
      if (response.data.events) {
        setEvents(response.data.events);
      }
      setLastUpdated(new Date());
    } catch (error) {
      if (error.response?.status === 401) {
        alert('Please sign in to control the garage door');
      } else {
        console.error('Error toggling garage:', error);
      }
    }
    setLoading(false);
  };

  // Door open duration ticker - uses backend UTC timestamp
  useEffect(() => {
    if (!doorOpenedAt) return;
    const openedTime = new Date(doorOpenedAt);
    const tick = setInterval(() => {
      const seconds = Math.floor((new Date() - openedTime) / 1000);
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      setDoorOpenDuration(mins > 0 ? `${mins}m ${secs}s` : `${secs}s`);
    }, 1000);
    return () => clearInterval(tick);
  }, [doorOpenedAt]);

  const toggleHoldOpen = async () => {
    try {
      const response = await axios.post('/api/hold-open');
      setHoldOpen(response.data.hold_open);
    } catch (error) {
      if (error.response?.status === 401) {
        alert('Please sign in to toggle Hold Open');
      }
    }
  };

  const cancelAutoClose = async () => {
    try {
      await axios.post('/api/lpr/cancel');
      setCountdown(0);
      setPendingPlate(null);
    } catch (error) {
      console.error('Error cancelling auto-close:', error);
    }
  };

  const formatLastUpdated = (date) => {
    return date.toLocaleString('en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center px-4 py-12">
      <LPRNotification countdown={countdown} plate={pendingPlate} onCancel={cancelAutoClose} isAuthenticated={isAuthenticated} />

      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center items-center gap-3">
            <h2 className="text-center text-3xl font-extrabold text-gray-900 dark:text-white">
              Garage Door Controller
            </h2>
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-full text-gray-500 dark:text-yellow-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Monitor and control your garage door
          </p>
          {isAuthenticated && (
            <div className="mt-2 flex justify-center items-center gap-2">
              <span className="text-xs text-green-600 dark:text-green-400">Signed in as {username}</span>
              <button
                onClick={handleLogout}
                className="inline-flex items-center text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <LogOut className="h-3 w-3 mr-1" />
                Sign out
              </button>
            </div>
          )}
        </div>

        <div className="mt-8 space-y-6">
          <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                Current Status
              </h3>
              <div className="mt-5">
                <div className="rounded-md bg-gray-50 dark:bg-gray-700 px-6 py-5 sm:flex sm:items-start sm:justify-between">
                  <div className="sm:flex sm:items-center w-full">
                    {status === 'Open' ? (
                      <GarageOpen className="h-8 w-8 text-green-400" aria-hidden="true" />
                    ) : status === 'Closed' ? (
                      <GarageClosed className="h-8 w-8 text-red-400" aria-hidden="true" />
                    ) : (
                      <Loader className="h-8 w-8 text-gray-400 animate-spin" aria-hidden="true" />
                    )}
                    <div className="mt-3 sm:mt-0 sm:ml-4 flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-200">
                        The garage door is currently {status.toLowerCase()}
                      </div>
                      {status === 'Open' && doorOpenDuration && (
                        <div className="mt-1 flex items-center text-gray-500 dark:text-gray-400 text-xs">
                          <Timer className="h-3 w-3 mr-1" />
                          Open for {doorOpenDuration}
                        </div>
                      )}
                      {holdOpen && (
                        <div className="mt-1 flex items-center text-orange-600 dark:text-orange-400 text-xs font-medium">
                          <ShieldCheck className="h-3 w-3 mr-1" />
                          Hold Open active
                        </div>
                      )}
                      {countdown > 0 && (
                        <div className="mt-1 flex items-center text-yellow-700 dark:text-yellow-400 text-xs">
                          <Clock className="h-4 w-4 mr-1" />
                          LPR closing in {countdown}s
                        </div>
                      )}
                      {autoCloseCountdown > 0 && !holdOpen && (
                        <div className="mt-1 flex items-center text-red-600 dark:text-red-400 text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          Safety close in {Math.floor(autoCloseCountdown / 60)}m {autoCloseCountdown % 60}s
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {isAuthenticated ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={toggleGarage}
                  disabled={loading || holdOpen}
                  className={`flex-1 group relative flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                    loading || holdOpen
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                  }`}
                >
                  {loading ? (
                    <Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                  ) : null}
                  {loading ? 'Processing...' : holdOpen ? 'Hold Open Active' : 'Toggle Garage Door'}
                </button>

                {countdown > 0 && (
                  <button
                    onClick={cancelAutoClose}
                    className="px-4 py-2 border border-red-300 dark:border-red-600 text-sm font-medium rounded-md text-red-700 dark:text-red-400 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    Cancel
                  </button>
                )}
              </div>

              <button
                onClick={toggleHoldOpen}
                className={`w-full flex justify-center items-center py-2 px-4 text-sm font-medium rounded-md border ${
                  holdOpen
                    ? 'bg-orange-100 dark:bg-orange-900/30 border-orange-400 dark:border-orange-600 text-orange-700 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50'
                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {holdOpen ? (
                  <><ShieldCheck className="h-4 w-4 mr-2" /> Hold Open ON — Tap to Disable</>
                ) : (
                  <><ShieldOff className="h-4 w-4 mr-2" /> Hold Open OFF — Tap to Keep Open</>
                )}
              </button>
            </div>
          ) : (
            <LoginForm onLogin={handleLogin} />
          )}

          <EventList events={events} />
          <LPRManagement isAuthenticated={isAuthenticated} />
          <SettingsPanel isAuthenticated={isAuthenticated} />
          <LogViewer isAuthenticated={isAuthenticated} />

          <div className="text-center mt-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Last updated: {formatLastUpdated(lastUpdated)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
