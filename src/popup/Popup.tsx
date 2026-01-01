import { useEffect, useState } from 'react';
import {
  Shield,
  AlertTriangle,
  Send,
  Settings,
  Server,
  Key,
  CheckCircle,
  XCircle,
  Loader,
  ChevronLeft,
  FileText,
  Activity
} from 'lucide-react';
import './Popup.css';

interface Stats {
  secretsDetected: number;
  secretsBlocked: number;
  messagesSent: number;
  serverScans?: number;
  serverErrors?: number;
}

type ScanMode = 'local' | 'server' | 'hybrid';

type View = 'main' | 'settings';

function Popup() {
  const [view, setView] = useState<View>('main');
  const [stats, setStats] = useState<Stats>({
    secretsDetected: 0,
    secretsBlocked: 0,
    messagesSent: 0,
    serverScans: 0,
    serverErrors: 0,
  });

  // Settings state
  const [serverUrl, setServerUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [scanMode, setScanMode] = useState<ScanMode>('hybrid');
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'checking' | 'connected' | 'error'>('unknown');
  const [statusMessage, setStatusMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Load stats from storage
    chrome.storage.local.get(['stats', 'serverUrl', 'apiKey', 'scanMode'], (result) => {
      if (result.stats) {
        setStats(result.stats);
      }
      if (result.serverUrl) {
        setServerUrl(result.serverUrl);
      }
      if (result.apiKey) {
        setApiKey(result.apiKey);
      }
      if (result.scanMode) {
        setScanMode(result.scanMode);
      }

      // Check connection if configured
      if (result.serverUrl && result.apiKey) {
        checkConnection(result.serverUrl);
      }
    });
  }, []);

  const checkConnection = async (url: string) => {
    setConnectionStatus('checking');
    try {
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      if (response.ok) {
        setConnectionStatus('connected');
        setStatusMessage('Connected to server');
      } else {
        setConnectionStatus('error');
        setStatusMessage('Server returned error');
      }
    } catch (e) {
      setConnectionStatus('error');
      setStatusMessage('Cannot reach server');
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);

    try {
      // Validate API key if server is configured
      if (serverUrl && apiKey) {
        const response = await fetch(`${serverUrl}/api/v1/extension/validate-key`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: apiKey }),
        });

        if (!response.ok) {
          setConnectionStatus('error');
          setStatusMessage('Invalid API key');
          setIsSaving(false);
          return;
        }

        const data = await response.json();
        if (!data.valid) {
          setConnectionStatus('error');
          setStatusMessage('API key validation failed');
          setIsSaving(false);
          return;
        }
      }

      // Save to storage
      await chrome.storage.local.set({
        serverUrl,
        apiKey,
        scanMode,
      });

      // Send message to background script to update all tabs
      try {
        await chrome.runtime.sendMessage({
          type: 'SETTINGS_UPDATED',
          serverUrl,
          apiKey,
          scanMode,
        });
      } catch (err) {
        // Background script will handle broadcasting to content scripts
        console.log('[Niyantra] Settings updated, background will sync');
      }

      setConnectionStatus('connected');
      setStatusMessage('Settings saved');
    } catch (e) {
      setConnectionStatus('error');
      setStatusMessage('Failed to save settings');
    }

    setIsSaving(false);
  };

  const protectionRate =
    stats.secretsDetected > 0
      ? Math.round((stats.secretsBlocked / stats.secretsDetected) * 100)
      : 0;

  // Settings View
  if (view === 'settings') {
    return (
      <div className="popup-container">
        {/* Header */}
        <div className="header">
          <div className="header-top">
            <button
              onClick={() => setView('main')}
              className="icon-btn"
              title="Back"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="settings-header-content" style={{ textAlign: 'right' }}>
              <h1 className="settings-title">Settings</h1>
              <p className="settings-subtitle">Configuration</p>
            </div>
          </div>
        </div>

        {/* Settings Form */}
        <div className="content">
          {/* Connection Status */}
          <div className={`connection-banner ${connectionStatus}`}>
            {connectionStatus === 'checking' ? (
              <Loader size={16} className="animate-spin" />
            ) : connectionStatus === 'connected' ? (
              <CheckCircle size={16} />
            ) : connectionStatus === 'error' ? (
              <XCircle size={16} />
            ) : (
              <Server size={16} />
            )}
            <span>{statusMessage || 'Not configured'}</span>
          </div>

          {/* Server URL */}
          <div className="form-group">
            <label className="form-label">
              <Server size={14} />
              Server URL
            </label>
            <input
              type="url"
              className="form-input"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://niyantra.yourcompany.com"
            />
            <p className="form-hint">Your organization's Niyantra server address</p>
          </div>

          {/* API Key */}
          <div className="form-group">
            <label className="form-label">
              <Key size={14} />
              API Key
            </label>
            <input
              type="password"
              className="form-input"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="niy_xxxxxxxxxxxxx"
              style={{ fontFamily: 'monospace' }}
            />
            <p className="form-hint">Get this from your Niyantra dashboard</p>
          </div>

          {/* Scan Mode */}
          <div className="form-group">
            <label className="form-label" style={{ marginBottom: '12px' }}>
              Scan Mode
            </label>
            <div className="scan-mode-group">
              {[
                { value: 'local', label: 'Local Only', desc: 'Privacy-first client-side detection' },
                { value: 'hybrid', label: 'Hybrid (Recommended)', desc: 'Local + server for best coverage' },
                { value: 'server', label: 'Server Only', desc: 'Full server-side analysis' },
              ].map((mode) => (
                <div
                  key={mode.value}
                  className={`scan-mode-card ${scanMode === mode.value ? 'selected' : ''}`}
                  onClick={() => setScanMode(mode.value as ScanMode)}
                >
                  <div style={{
                    marginTop: '3px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    border: `1px solid ${scanMode === mode.value ? 'var(--primary-color)' : '#d1d5db'}`,
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {scanMode === mode.value && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary-color)' }} />}
                  </div>
                  <div className="scan-mode-info">
                    <div className="scan-mode-title">{mode.label}</div>
                    <div className="scan-mode-desc">{mode.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={saveSettings}
            disabled={isSaving}
            className="save-btn"
          >
            {isSaving ? (
              <>
                <Loader size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </button>
        </div>
      </div>
    );
  }

  // Main View
  return (
    <div className="popup-container">
      {/* Header */}
      <div className="header">
        <div className="header-top">
          <div className="brand">
            <Shield size={24} />
            <h1>Niyantra</h1>
          </div>
          <button
            onClick={() => setView('settings')}
            className="icon-btn"
            title="Settings"
          >
            <Settings size={18} />
          </button>
        </div>
        <p className="subtitle">AI Chat Secret & PII Detection</p>

        {/* Server Status Badge */}
        <div className="status-badge">
          {serverUrl ? (
            <>
              <div className={`status-dot ${connectionStatus === 'connected' ? 'connected' : 'configured'}`} />
              {connectionStatus === 'connected' ? 'Server Online' : 'Server Configured'}
            </>
          ) : (
            <>
              <div className="status-dot local" />
              Local Mode
            </>
          )}
        </div>
      </div>

      <div className="content">
        <h2 className="section-title">Protection Stats</h2>

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card detected">
            <div className="stat-header">
              <AlertTriangle size={14} className="text-amber-600" color="#d97706" />
              Secrets Detected
            </div>
            <div className="stat-value">{stats.secretsDetected}</div>
          </div>

          <div className="stat-card blocked">
            <div className="stat-header">
              <Shield size={14} className="text-emerald-600" color="#059669" />
              Blocked
            </div>
            <div className="stat-value">{stats.secretsBlocked}</div>
          </div>

          <div className="stat-card messages">
            <div className="stat-header">
              <Send size={14} className="text-blue-600" color="#2563eb" />
              Messages
            </div>
            <div className="stat-value">{stats.messagesSent}</div>
          </div>

          <div className="stat-card scans">
            <div className="stat-header">
              {serverUrl ? <Server size={14} color="#7c3aed" /> : <Activity size={14} color="#7c3aed" />}
              {serverUrl ? 'Server Scans' : 'Local Scans'}
            </div>
            <div className="stat-value">{serverUrl ? (stats.serverScans || 0) : (stats.messagesSent)}</div>
          </div>
        </div>


        {/* Protection Rate */}
        {stats.secretsDetected > 0 && (
          <div className="protection-box">
            <div className="protection-header">
              <span className="protection-label">Protection Rate</span>
              <span className="protection-percent">{protectionRate}%</span>
            </div>
            <div className="progress-bar-bg">
              <div
                className="progress-bar-fill"
                style={{ width: `${protectionRate}%` }}
              />
            </div>
          </div>
        )}

        {/* Supported Sites */}
        <div>
          <h3 className="section-title">Protected Destinations</h3>
          <div className="sites-list">
            {['ChatGPT', 'Claude', 'Gemini', 'Perplexity', 'Grok'].map((site) => (
              <span key={site} className="site-badge">
                {site}
              </span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="footer">
          <a
            href="https://niyantra.com"
            target="_blank"
            rel="noopener noreferrer"
            className="learn-more-link"
          >
            <FileText size={16} />
            Learn More About Niyantra
          </a>
          <p className="version-text">
            v1.0.3 • Enterprise AI Governance
          </p>
        </div>
      </div>
    </div>
  );
}

export default Popup;

