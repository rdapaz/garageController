import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { DoorOpen, DoorClosed, Loader, AlertTriangle, X, Plus, Trash2, Car, Clock, LogIn, LogOut, Lock } from 'lucide-react';

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
    <form onSubmit={handleSubmit} className="bg-white shadow sm:rounded-lg mt-6">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center mb-4">
          <Lock className="h-5 w-5 text-indigo-500 mr-2" />
          <h3 className="text-lg leading-6 font-medium text-gray-900">Sign In</h3>
        </div>
        {error && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            required
            autoComplete="username"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            required
            autoComplete="current-password"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400"
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
    <div className="bg-white shadow sm:rounded-lg mt-6">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
          Recent Events
        </h3>
        {events.length === 0 ? (
          <p className="text-sm text-gray-500">No events recorded yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {events.map((event, index) => (
              <li key={index} className="py-3 flex items-center justify-between">
                <div className="flex items-center">
                  {event[0] === 'Open' ? (
                    <DoorOpen className="h-5 w-5 text-green-400 mr-3" />
                  ) : (
                    <DoorClosed className="h-5 w-5 text-red-400 mr-3" />
                  )}
                  <span className="text-sm font-medium text-gray-900">
                    Garage {event[0]}
                  </span>
                </div>
                <span className="text-sm text-gray-500">
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
    <div className="fixed top-4 right-4 max-w-sm w-full bg-yellow-50 border-l-4 border-yellow-400 p-4 shadow-lg rounded-lg z-50 animate-pulse">
      <div className="flex">
        <div className="flex-shrink-0">
          <AlertTriangle className="h-5 w-5 text-yellow-400" />
        </div>
        <div className="ml-3 flex-1">
          <p className="text-sm font-medium text-yellow-800">
            Auto-closing in {countdown} seconds
          </p>
          <p className="text-xs text-yellow-700 mt-1">
            Detected: {plate}
          </p>
          {isAuthenticated && (
            <button
              onClick={onCancel}
              className="mt-2 text-xs font-medium text-yellow-800 hover:text-yellow-900 underline"
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
    <div className="bg-white shadow sm:rounded-lg mt-6">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Authorized Plates
          </h3>
          {isAuthenticated && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Plate
            </button>
          )}
        </div>

        {showForm && isAuthenticated && (
          <form onSubmit={addPlate} className="mb-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Plate Number"
                value={newPlate}
                onChange={(e) => setNewPlate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                required
              />
              <input
                type="text"
                placeholder="Owner Name"
                value={newOwner}
                onChange={(e) => setNewOwner(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:bg-gray-400"
              >
                {loading ? 'Adding...' : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <ul className="divide-y divide-gray-200">
          {plates.filter(p => p.active).map((plate, index) => (
            <li key={index} className="py-3 flex items-center justify-between">
              <div className="flex items-center">
                <Car className="h-5 w-5 text-indigo-400 mr-3" />
                <div>
                  <span className="text-sm font-medium text-gray-900">{plate.plate}</span>
                  {plate.owner && (
                    <span className="text-xs text-gray-500 ml-2">({plate.owner})</span>
                  )}
                </div>
              </div>
              {isAuthenticated && (
                <button
                  onClick={() => removePlate(plate.plate)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
          {plates.filter(p => p.active).length === 0 && (
            <li className="py-3 text-sm text-gray-500">No authorized plates yet</li>
          )}
        </ul>
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
    const ws = new WebSocket(`ws://${window.location.host}/ws`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'status_update') {
        setStatus(data.status);
        if (data.events) {
          setEvents(data.events);
        }
        if (data.countdown !== undefined) {
          setCountdown(data.countdown);
        }
        if (data.pending_close_plate !== undefined) {
          setPendingPlate(data.pending_close_plate);
        }
        setLastUpdated(new Date());
      } else if (data.type === 'lpr_status') {
        if (data.data.action === 'countdown') {
          setCountdown(data.data.seconds_remaining);
          setPendingPlate(data.data.plate);
        } else if (data.data.action === 'cancelled' || data.data.action === 'cancelled_by_user') {
          setCountdown(0);
          setPendingPlate(null);
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
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4 py-12">
      <LPRNotification countdown={countdown} plate={pendingPlate} onCancel={cancelAutoClose} isAuthenticated={isAuthenticated} />

      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Garage Door Controller
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Monitor and control your garage door
          </p>
          {isAuthenticated && (
            <div className="mt-2 flex justify-center items-center gap-2">
              <span className="text-xs text-green-600">Signed in as {username}</span>
              <button
                onClick={handleLogout}
                className="inline-flex items-center text-xs text-gray-500 hover:text-gray-700"
              >
                <LogOut className="h-3 w-3 mr-1" />
                Sign out
              </button>
            </div>
          )}
        </div>

        <div className="mt-8 space-y-6">
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Current Status
              </h3>
              <div className="mt-5">
                <div className="rounded-md bg-gray-50 px-6 py-5 sm:flex sm:items-start sm:justify-between">
                  <div className="sm:flex sm:items-center w-full">
                    {status === 'Open' ? (
                      <DoorOpen className="h-8 w-8 text-green-400" aria-hidden="true" />
                    ) : status === 'Closed' ? (
                      <DoorClosed className="h-8 w-8 text-red-400" aria-hidden="true" />
                    ) : (
                      <Loader className="h-8 w-8 text-gray-400 animate-spin" aria-hidden="true" />
                    )}
                    <div className="mt-3 sm:mt-0 sm:ml-4 flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        The garage door is currently {status.toLowerCase()}
                      </div>
                      {countdown > 0 && (
                        <div className="mt-2 flex items-center text-yellow-700 text-xs">
                          <Clock className="h-4 w-4 mr-1" />
                          Closing in {countdown}s
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {isAuthenticated ? (
            <div className="flex gap-2">
              <button
                onClick={toggleGarage}
                disabled={loading}
                className={`flex-1 group relative flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                  loading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                }`}
              >
                {loading ? (
                  <Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                ) : null}
                {loading ? 'Processing...' : 'Toggle Garage Door'}
              </button>

              {countdown > 0 && (
                <button
                  onClick={cancelAutoClose}
                  className="px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
                >
                  Cancel
                </button>
              )}
            </div>
          ) : (
            <LoginForm onLogin={handleLogin} />
          )}

          <EventList events={events} />
          <LPRManagement isAuthenticated={isAuthenticated} />

          <div className="text-center mt-4">
            <p className="text-sm text-gray-500">
              Last updated: {formatLastUpdated(lastUpdated)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
