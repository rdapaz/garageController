import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { DoorOpen, DoorClosed, Loader } from 'lucide-react';

export default function App() {
  const [status, setStatus] = useState('Unknown');
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // WebSocket handling
  const setupWebSocket = useCallback(() => {
    const ws = new WebSocket(`ws://${window.location.host}/ws`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setStatus(data.status);
      setLastUpdated(new Date());
      fetchEvents();  // Update events whenever a WebSocket message is received
    };

    ws.onclose = () => {
      console.log('WebSocket closed. Reconnecting...');
      setTimeout(setupWebSocket, 1000);
    };

    return () => {
      ws.close();
    };
  }, []);

  // Toggle dark mode
  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
  };

  // Fetch saved theme preference on load
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Fetch the last 10 events
  const fetchEvents = async () => {
    try {
      const response = await axios.get('/api/events');
      setEvents(response.data);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  useEffect(() => {
    const cleanup = setupWebSocket();
    fetchEvents();  // Fetch initial events
    return cleanup;
  }, [setupWebSocket]);

  const toggleGarage = async () => {
    setLoading(true);
    try {
      const response = await axios.post('/api/toggle');
      setStatus(response.data.status);
      setLastUpdated(new Date());
      fetchEvents();  // Fetch updated events after toggling
    } catch (error) {
      console.error('Error toggling garage:', error);
    }
    setLoading(false);
  };

  const formatLastUpdated = (date) => {
    return date.toLocaleString('en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Garage Door Controller
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            (c) Ricdeez 2024
          </p>
        </div>

        {/* Dark Mode Toggle */}
        <div className="text-center">
          <button
            onClick={toggleDarkMode}
            className="py-2 px-4 rounded-md text-sm font-medium bg-indigo-600 text-white dark:bg-yellow-500"
          >
            {isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          </button>
        </div>

        <div className="mt-8 space-y-6">
          <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                Current Status
              </h3>
              <div className="mt-5 flex items-center">
                {status === 'Open' ? (
                  <DoorOpen className="h-8 w-8 text-green-400" aria-hidden="true" />
                ) : status === 'Closed' ? (
                  <DoorClosed className="h-8 w-8 text-red-400" aria-hidden="true" />
                ) : (
                  <Loader className="h-8 w-8 text-gray-400 animate-spin" aria-hidden="true" />
                )}
                <div className="ml-4 text-sm font-medium text-gray-900 dark:text-white">
                  The garage door is currently {status ? status.toLowerCase() : 'unknown'}
                </div>
              </div>
              <div className="mt-5">
                <button
                  onClick={toggleGarage}
                  disabled={loading}
                  className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white dark:bg-indigo-500 dark:hover:bg-indigo-600 ${
                    loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {loading ? <Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" /> : null}
                  {loading ? 'Working on it...' : 'Toggle Garage Door'}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">Last 10 Events</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Timestamp
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {events.map((event, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-gray-100 dark:bg-gray-900' : 'bg-white dark:bg-gray-800'}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{event.status}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{new Date(event.timestamp).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

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
