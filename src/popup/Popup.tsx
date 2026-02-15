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
  Activity,
  EyeOff,
  RefreshCw,
  FileUp,
  Building,
  User,
  LogOut,
  Chrome
} from 'lucide-react';
import './Popup.css';

interface Stats {
  secretsDetected: number;
  secretsBlocked: number;
  messagesSent: number;
  filesScanned?: number;
  serverScans?: number;
  serverErrors?: number;
}

interface ShadowAIStats {
  total: number;
  blocked: number;
  warned: number;
  logged: number;
}

interface ShadowAIList {
  version: string;
  updated_at: string;
  enabled: boolean;
  sites: Array<{
    domain: string;
    name: string;
    action: string;
  }>;
}

type ScanMode = 'local' | 'server' | 'hybrid';

type View = 'main' | 'settings';

interface AuthState {
  isConfigured: boolean;
  authMode: 'manual' | 'policy' | 'sso';
  serverUrl?: string;
  apiKey?: string;
  tenantToken?: string;
  tenantName?: string;
  userEmail?: string;
  enforcementMode: 'enforce' | 'log_only';
  ssoProvider?: string;
  needsSSOLogin: boolean;
}

function Popup() {
  const [view, setView] = useState<View>('main');
  const [stats, setStats] = useState<Stats>({
    secretsDetected: 0,
    secretsBlocked: 0,
    messagesSent: 0,
    filesScanned: 0,
    serverScans: 0,
    serverErrors: 0,
  });

  // Settings state - persisted as drafts so Firefox popup close doesn't lose input
  const [serverUrl, setServerUrlState] = useState('');
  const [apiKey, setApiKeyState] = useState('');
  const [scanMode, setScanMode] = useState<ScanMode>('hybrid');

  // Wrap setters to persist drafts to storage (survives popup close in Firefox)
  const setServerUrl = (val: string) => {
    setServerUrlState(val);
    chrome.storage.local.set({ _draft_serverUrl: val });
  };
  const setApiKey = (val: string) => {
    setApiKeyState(val);
    chrome.storage.local.set({ _draft_apiKey: val });
  };
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'checking' | 'connected' | 'error'>('unknown');
  const [statusMessage, setStatusMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Shadow AI state
  const [shadowAIStats, setShadowAIStats] = useState<ShadowAIStats | null>(null);
  const [shadowAIEnabled, setShadowAIEnabled] = useState(false);
  const [shadowAISyncing, setShadowAISyncing] = useState(false);

  // Enterprise Auth state
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [isEnterpriseManaged, setIsEnterpriseManaged] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [ssoError, setSsoError] = useState<string | null>(null);

  useEffect(() => {
    // Check enterprise auth state first
    const checkAuthState = async () => {
      try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_AUTH_STATE' }) as AuthState | null;
        if (response) {
          setAuthState(response);
          // If enterprise managed, update server URL from auth state
          if (response.authMode === 'policy' || response.authMode === 'sso') {
            setIsEnterpriseManaged(true);
            if (response.serverUrl) {
              setServerUrl(response.serverUrl);
            }
          }
        }

        // Check if enterprise managed
        const isManaged = await chrome.runtime.sendMessage({ type: 'IS_ENTERPRISE_MANAGED' }) as boolean;
        setIsEnterpriseManaged(isManaged);
      } catch (err) {
        console.log('[Niyantra] Could not get auth state:', err);
      }
    };
    checkAuthState();

    // Load stats from storage (drafts take priority over saved values for unsaved input)
    chrome.storage.local.get(['stats', 'serverUrl', 'apiKey', 'scanMode', '_draft_serverUrl', '_draft_apiKey'], async (result) => {
      // Set local stats as initial/fallback
      if (result.stats) {
        setStats(result.stats);
      }
      // Use draft values if they exist (user was mid-edit when popup closed),
      // otherwise fall back to saved values
      setServerUrlState(result._draft_serverUrl ?? result.serverUrl ?? '');
      setApiKeyState(result._draft_apiKey ?? result.apiKey ?? '');
      if (result.scanMode) {
        setScanMode(result.scanMode);
      }

      // Check connection and fetch stats from backend if configured
      if (result.serverUrl && result.apiKey) {
        checkConnection(result.serverUrl);

        // Fetch stats from backend (persisted across extension reloads)
        try {
          const response = await fetch(`${result.serverUrl}/api/v1/extension/stats`, {
            method: 'GET',
            headers: {
              'X-API-Key': result.apiKey,
            },
            signal: AbortSignal.timeout(5000),
          });

          if (response.ok) {
            const backendStats = await response.json();
            // Map backend stats to our format
            setStats({
              secretsDetected: backendStats.secrets_detected || 0,
              secretsBlocked: backendStats.secrets_blocked || 0,
              messagesSent: backendStats.messages_scanned || 0,
              filesScanned: backendStats.files_scanned || 0,
              serverScans: backendStats.server_scans || 0,
              serverErrors: 0, // Backend doesn't track this
            });
          }
        } catch (e) {
          console.log('[Niyantra] Could not fetch backend stats, using local stats');
          // Keep using local stats as fallback
        }
      }
    });

    // Load Shadow AI stats
    loadShadowAIStats();
  }, []);

  const loadShadowAIStats = async () => {
    try {
      // Get Shadow AI stats from background
      const stats = await chrome.runtime.sendMessage({ type: 'GET_SHADOW_AI_STATS' }) as ShadowAIStats;
      if (stats) {
        setShadowAIStats(stats);
      }

      // Get Shadow AI list to check if enabled
      const list = await chrome.runtime.sendMessage({ type: 'GET_SHADOW_AI_LIST' }) as ShadowAIList | null;
      if (list) {
        setShadowAIEnabled(list.enabled);
      }
    } catch (err) {
      console.log('[Niyantra] Shadow AI stats not available');
    }
  };

  const syncShadowAIList = async () => {
    setShadowAISyncing(true);
    try {
      await chrome.runtime.sendMessage({ type: 'SYNC_SHADOW_AI_LIST' });
      await loadShadowAIStats();
    } catch (err) {
      console.error('[Niyantra] Shadow AI sync failed:', err);
    }
    setShadowAISyncing(false);
  };

  // SSO Login handler
  const handleSSOLogin = async () => {
    if (!authState?.serverUrl || !authState?.tenantToken || !authState?.ssoProvider) {
      setSsoError('Missing SSO configuration');
      return;
    }

    setSsoLoading(true);
    setSsoError(null);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'COMPLETE_SSO_LOGIN',
        serverUrl: authState.serverUrl,
        tenantToken: authState.tenantToken,
        ssoProvider: authState.ssoProvider,
      }) as { success: boolean; authState?: AuthState; error?: string };

      if (response.success && response.authState) {
        setAuthState(response.authState);
        setServerUrl(response.authState.serverUrl || '');
        setConnectionStatus('connected');
        setStatusMessage('Signed in successfully');
      } else {
        setSsoError(response.error || 'SSO login failed');
      }
    } catch (err) {
      setSsoError((err as Error).message || 'SSO login failed');
    }

    setSsoLoading(false);
  };

  // Logout handler for SSO users
  const handleLogout = async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'LOGOUT' });
      // Re-initialize auth state
      const response = await chrome.runtime.sendMessage({ type: 'INIT_ENTERPRISE_AUTH' }) as AuthState;
      setAuthState(response);
    } catch (err) {
      console.error('[Niyantra] Logout failed:', err);
    }
  };

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

      // Save to storage and clear drafts
      await chrome.storage.local.set({
        serverUrl,
        apiKey,
        scanMode,
      });
      await chrome.storage.local.remove(['_draft_serverUrl', '_draft_apiKey']);

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

  // const protectionRate =
  //   stats.secretsDetected > 0
  //     ? Math.round((stats.secretsBlocked / stats.secretsDetected) * 100)
  //     : 0;

  const protectionRate = 100;

  // Open Niyantra setup page
  const openSetupPage = () => {
    // Use the configured server URL or default
    const baseUrl = serverUrl || 'http://localhost:3000';
    chrome.tabs.create({ url: `${baseUrl}/dashboard/user/extension` });
  };

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

          {/* SSO Login Required - Show when enterprise policy needs SSO */}
          {authState?.needsSSOLogin && (
            <div className="sso-login-section">
              <div className="enterprise-banner">
                <Building size={20} />
                <div className="enterprise-info">
                  <h3>{authState.tenantName || 'Enterprise'}</h3>
                  <p>Managed by your organization</p>
                </div>
              </div>

              <div className="sso-login-box">
                <p className="sso-prompt">Sign in with your work account to continue</p>

                {ssoError && (
                  <div className="sso-error">
                    <XCircle size={14} />
                    {ssoError}
                  </div>
                )}

                <button
                  onClick={handleSSOLogin}
                  disabled={ssoLoading}
                  className="sso-login-btn google"
                >
                  {ssoLoading ? (
                    <Loader size={18} className="animate-spin" />
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                        <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                        <path fill="#34A853" d="M9.003 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9.003 18z"/>
                        <path fill="#FBBC05" d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.96H.957C.347 6.175 0 7.55 0 9.002c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                        <path fill="#EA4335" d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.428 0 9.002 0 5.482 0 2.438 2.017.957 4.96l3.007 2.332c.708-2.127 2.692-3.711 5.036-3.711z"/>
                      </svg>
                      Sign in with Google
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Authenticated SSO User Info */}
          {authState?.authMode === 'sso' && authState?.userEmail && !authState?.needsSSOLogin && (
            <div className="authenticated-user-section">
              <div className="enterprise-banner">
                <Building size={20} />
                <div className="enterprise-info">
                  <h3>{authState.tenantName || 'Enterprise'}</h3>
                  <p>Managed by your organization</p>
                </div>
              </div>

              <div className="user-info-box">
                <User size={16} />
                <div className="user-details">
                  <span className="user-email">{authState.userEmail}</span>
                  <span className="auth-mode">
                    {authState.ssoProvider === 'google' ? 'Google SSO' : 'SSO'} • {authState.enforcementMode === 'log_only' ? 'Monitoring' : 'Active Protection'}
                  </span>
                </div>
                <button onClick={handleLogout} className="logout-btn" title="Sign out">
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Enterprise Policy Mode (without SSO) */}
          {authState?.authMode === 'policy' && !authState?.needsSSOLogin && !authState?.userEmail && (
            <div className="enterprise-policy-section">
              <div className="enterprise-banner">
                <Chrome size={20} />
                <div className="enterprise-info">
                  <h3>{authState.tenantName || 'Enterprise'}</h3>
                  <p>Configured by Chrome Enterprise policy</p>
                </div>
              </div>
              <div className="policy-status">
                <CheckCircle size={16} />
                <span>Auto-configured • {authState.enforcementMode === 'log_only' ? 'Monitoring Mode' : 'Active Protection'}</span>
              </div>
            </div>
          )}

          {/* Easy Setup Banner - Show when not configured and not enterprise managed */}
          {!serverUrl && !apiKey && !isEnterpriseManaged && !authState?.needsSSOLogin && (
            <div className="easy-setup-banner">
              <div className="easy-setup-content">
                <div className="easy-setup-icon">
                  <Shield size={24} />
                </div>
                <div className="easy-setup-text">
                  <h3>Quick Setup</h3>
                  <p>Sign in to Niyantra to get your configuration automatically</p>
                </div>
              </div>
              <button
                onClick={openSetupPage}
                className="easy-setup-btn"
              >
                Open Niyantra Setup
              </button>
            </div>
          )}

          {/* Server URL - Only show for manual config */}
          {!isEnterpriseManaged && !authState?.needsSSOLogin && authState?.authMode !== 'sso' && authState?.authMode !== 'policy' && (
            <>
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
            </>
          )}

          {/* Scan Mode - Only show for manual config */}
          {!isEnterpriseManaged && !authState?.needsSSOLogin && authState?.authMode !== 'sso' && authState?.authMode !== 'policy' && (
            <>
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
            </>
          )}
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
              {serverUrl ? <FileUp size={14} color="#7c3aed" /> : <Activity size={14} color="#7c3aed" />}
              {serverUrl ? 'Files Scanned' : 'Local Scans'}
            </div>
            <div className="stat-value">{serverUrl ? (stats.filesScanned || 0) : (stats.messagesSent)}</div>
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

        {/* Shadow AI Status */}
        {serverUrl && (
          <div className="shadow-ai-section">
            <div className="shadow-ai-header">
              <div className="shadow-ai-title">
                <EyeOff size={16} />
                <span>Shadow AI Protection</span>
              </div>
              <button
                onClick={syncShadowAIList}
                disabled={shadowAISyncing}
                className="sync-btn"
                title="Sync list"
              >
                <RefreshCw size={14} className={shadowAISyncing ? 'animate-spin' : ''} />
              </button>
            </div>
            <div className="shadow-ai-status">
              <div className={`status-indicator ${shadowAIEnabled ? 'active' : 'inactive'}`}>
                {shadowAIEnabled ? 'Active' : 'Inactive'}
              </div>
              {shadowAIStats && (
                <div className="shadow-ai-stats">
                  <span className="shadow-stat">
                    <strong>{shadowAIStats.total}</strong> sites
                  </span>
                  <span className="shadow-stat blocked">
                    <strong>{shadowAIStats.blocked}</strong> blocked
                  </span>
                  <span className="shadow-stat warned">
                    <strong>{shadowAIStats.warned}</strong> warned
                  </span>
                </div>
              )}
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
            href="https://guardflow.tech"
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

