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
} from 'lucide-react';

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
      <div style={{ background: 'white', minWidth: '320px' }}>
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '16px 20px',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <button
            onClick={() => setView('main')}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '6px',
              padding: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ChevronLeft size={18} color="white" />
          </button>
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 600 }}>Settings</h1>
            <p style={{ fontSize: '12px', opacity: 0.9 }}>Server Configuration</p>
          </div>
        </div>

        {/* Settings Form */}
        <div style={{ padding: '16px' }}>
          {/* Connection Status */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 12px',
              borderRadius: '8px',
              marginBottom: '16px',
              background:
                connectionStatus === 'connected'
                  ? '#dcfce7'
                  : connectionStatus === 'error'
                    ? '#fee2e2'
                    : '#f3f4f6',
            }}
          >
            {connectionStatus === 'checking' ? (
              <Loader size={16} className="animate-spin" color="#6b7280" />
            ) : connectionStatus === 'connected' ? (
              <CheckCircle size={16} color="#15803d" />
            ) : connectionStatus === 'error' ? (
              <XCircle size={16} color="#dc2626" />
            ) : (
              <Server size={16} color="#6b7280" />
            )}
            <span
              style={{
                fontSize: '13px',
                color:
                  connectionStatus === 'connected'
                    ? '#15803d'
                    : connectionStatus === 'error'
                      ? '#dc2626'
                      : '#6b7280',
              }}
            >
              {statusMessage || 'Not configured'}
            </span>
          </div>

          {/* Server URL */}
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: 500,
                color: '#374151',
                marginBottom: '6px',
              }}
            >
              <Server size={14} />
              Server URL
            </label>
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://niyantra.yourcompany.com"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
              Your organization's Niyantra server address
            </p>
          </div>

          {/* API Key */}
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: 500,
                color: '#374151',
                marginBottom: '6px',
              }}
            >
              <Key size={14} />
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="niy_xxxxxxxxxxxxx"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '13px',
                fontFamily: 'monospace',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
              Get this from your Niyantra dashboard
            </p>
          </div>

          {/* Scan Mode */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 500,
                color: '#374151',
                marginBottom: '8px',
              }}
            >
              Scan Mode
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { value: 'local', label: 'Local Only', desc: 'Fast, privacy-first detection' },
                { value: 'hybrid', label: 'Hybrid (Recommended)', desc: 'Local + server for best coverage' },
                { value: 'server', label: 'Server Only', desc: 'Full server-side scanning' },
              ].map((mode) => (
                <label
                  key={mode.value}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '10px',
                    border: `1px solid ${scanMode === mode.value ? '#6366f1' : '#e5e7eb'}`,
                    borderRadius: '8px',
                    background: scanMode === mode.value ? '#eef2ff' : 'white',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="scanMode"
                    value={mode.value}
                    checked={scanMode === mode.value}
                    onChange={() => setScanMode(mode.value as ScanMode)}
                    style={{ marginTop: '2px' }}
                  />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#111827' }}>
                      {mode.label}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>{mode.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={saveSettings}
            disabled={isSaving}
            style={{
              width: '100%',
              padding: '12px',
              background: isSaving ? '#9ca3af' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: isSaving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
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
    <div style={{ background: 'white', minWidth: '320px' }}>
      {/* Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '20px',
          color: 'white',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Shield size={24} />
            <h1 style={{ fontSize: '18px', fontWeight: 600 }}>Niyantra</h1>
          </div>
          <button
            onClick={() => setView('settings')}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '6px',
              padding: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Settings size={18} color="white" />
          </button>
        </div>
        <p style={{ fontSize: '13px', opacity: 0.9 }}>AI Chat Secret & PII Detection</p>

        {/* Server Status Badge */}
        <div
          style={{
            marginTop: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            background: 'rgba(255,255,255,0.2)',
            borderRadius: '12px',
            fontSize: '11px',
          }}
        >
          {serverUrl ? (
            <>
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: connectionStatus === 'connected' ? '#4ade80' : '#fbbf24',
                }}
              />
              {connectionStatus === 'connected' ? 'Server Connected' : 'Server Configured'}
            </>
          ) : (
            <>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#9ca3af' }} />
              Local Mode
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ padding: '16px' }}>
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '12px' }}>
            Protection Stats
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Secrets Detected */}
            <div
              style={{
                background: '#fef3c7',
                border: '1px solid #fde047',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={16} color="#d97706" />
                <span style={{ fontSize: '13px', color: '#92400e' }}>Secrets Detected</span>
              </div>
              <span style={{ fontSize: '16px', fontWeight: 600, color: '#92400e' }}>
                {stats.secretsDetected}
              </span>
            </div>

            {/* Secrets Blocked */}
            <div
              style={{
                background: '#dcfce7',
                border: '1px solid #86efac',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={16} color="#15803d" />
                <span style={{ fontSize: '13px', color: '#15803d' }}>Secrets Blocked</span>
              </div>
              <span style={{ fontSize: '16px', fontWeight: 600, color: '#15803d' }}>
                {stats.secretsBlocked}
              </span>
            </div>

            {/* Messages Sent */}
            <div
              style={{
                background: '#e0e7ff',
                border: '1px solid #c7d2fe',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Send size={16} color="#4338ca" />
                <span style={{ fontSize: '13px', color: '#4338ca' }}>Messages Sent</span>
              </div>
              <span style={{ fontSize: '16px', fontWeight: 600, color: '#4338ca' }}>
                {stats.messagesSent}
              </span>
            </div>

            {/* Server Scans (if server enabled) */}
            {serverUrl && stats.serverScans !== undefined && stats.serverScans > 0 && (
              <div
                style={{
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: '8px',
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Server size={16} color="#0369a1" />
                  <span style={{ fontSize: '13px', color: '#0369a1' }}>Server Scans</span>
                </div>
                <span style={{ fontSize: '16px', fontWeight: 600, color: '#0369a1' }}>
                  {stats.serverScans}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Protection Rate */}
        {stats.secretsDetected > 0 && (
          <div
            style={{
              background: '#f9fafb',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
              }}
            >
              <span style={{ fontSize: '12px', color: '#6b7280' }}>Protection Rate</span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                {protectionRate}%
              </span>
            </div>
            <div
              style={{ background: '#e5e7eb', borderRadius: '4px', height: '6px', overflow: 'hidden' }}
            >
              <div
                style={{
                  background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                  height: '100%',
                  width: `${protectionRate}%`,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        )}

        {/* Supported Sites */}
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', marginBottom: '8px' }}>
            Protected Sites
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {['ChatGPT', 'Claude', 'Gemini', 'Perplexity', 'Groq'].map((site) => (
              <span
                key={site}
                style={{
                  background: '#ede9fe',
                  color: '#6b21a8',
                  fontSize: '11px',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontWeight: 500,
                }}
              >
                {site}
              </span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: '1px solid #e5e7eb',
            paddingTop: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <a
            href="https://niyantra.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px',
              background: '#f3f4f6',
              borderRadius: '6px',
              color: '#374151',
              fontSize: '12px',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            <FileText size={14} />
            Learn More About Niyantra
          </a>
          <p style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'center' }}>
            v2.0.0 • Enterprise AI Governance
          </p>
        </div>
      </div>
    </div>
  );
}

export default Popup;
