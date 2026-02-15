/**
 * Enterprise Authentication Module
 *
 * Handles:
 * 1. Chrome Enterprise Policy (chrome.storage.managed)
 * 2. Google SSO via chrome.identity
 * 3. Automatic user provisioning
 */

import { storageGet, storageSet, storageRemove } from '../utils/storage';

// ============== Types ==============

export interface ManagedPolicy {
  serverUrl?: string;
  tenantToken?: string;
  authMode?: 'sso' | 'token';
  ssoProvider?: 'google' | 'microsoft' | 'okta';
  tenantName?: string;
  enforcementMode?: 'enforce' | 'log_only';
}

export interface TenantAuthResponse {
  success: boolean;
  tenant_id: number;
  tenant_name: string;
  server_url: string;
  enforcement_mode: string;
  sso_enabled: boolean;
  sso_provider?: string;
  sso_auth_url?: string;
}

export interface SSOAuthResponse {
  success: boolean;
  api_key: string;
  user_email: string;
  user_name?: string;
  tenant_name: string;
  enforcement_mode: string;
  expires_at?: string;
  message?: string;
}

export interface AuthState {
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

// ============== Chrome Enterprise Policy ==============

/**
 * Check if Chrome Enterprise policy is configured
 */
export async function getManagedPolicy(): Promise<ManagedPolicy | null> {
  try {
    // chrome.storage.managed only exists if policy is set
    if (!chrome.storage?.managed) {
      return null;
    }

    // Firefox with temporary addon IDs throws on managed storage access.
    // Use Promise wrapper that handles both Chrome (callback) and Firefox (Promise) styles.
    const policy = await new Promise<Record<string, unknown> | null>((resolve) => {
      try {
        chrome.storage.managed.get(null, (data) => {
          if (chrome.runtime.lastError) {
            console.log('[Niyantra] No managed policy found:', chrome.runtime.lastError.message);
            resolve(null);
            return;
          }
          resolve(data || null);
        });
      } catch {
        // Firefox throws synchronously for temporary addon IDs
        resolve(null);
      }
    });

    if (policy && Object.keys(policy).length > 0) {
      console.log('[Niyantra] Managed policy found:', policy);
      return policy as ManagedPolicy;
    }
    return null;
  } catch {
    // Catch-all for any unexpected errors
    return null;
  }
}

/**
 * Authenticate using tenant token from Chrome policy
 */
export async function authenticateWithTenantToken(
  serverUrl: string,
  tenantToken: string
): Promise<TenantAuthResponse> {
  const response = await fetch(`${serverUrl}/api/v1/extension/auth-tenant`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tenant_token: tenantToken }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Authentication failed' }));
    throw new Error(error.detail || `Authentication failed: ${response.status}`);
  }

  return response.json();
}

// ============== Google SSO ==============

/**
 * Get Google OAuth token using chrome.identity
 */
export async function getGoogleAuthToken(interactive: boolean = true): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!token) {
        reject(new Error('No token returned from Google'));
        return;
      }
      resolve(token);
    });
  });
}

/**
 * Get user info from Google token
 */
export async function getGoogleUserInfo(accessToken: string): Promise<{ email: string; name: string }> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get user info from Google');
  }

  const data = await response.json();
  return {
    email: data.email,
    name: data.name || data.email.split('@')[0],
  };
}

/**
 * Authenticate with backend using Google SSO
 */
export async function authenticateWithGoogleSSO(
  serverUrl: string,
  tenantToken: string,
  accessToken: string
): Promise<SSOAuthResponse> {
  // Get ID token from Google (for backend verification)
  // Note: In production, we'd use the ID token. For now, we pass access token
  // and backend will validate with Google's tokeninfo endpoint

  const response = await fetch(`${serverUrl}/api/v1/extension/auth-sso`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tenant_token: tenantToken,
      provider: 'google',
      id_token: accessToken, // Backend will handle this
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'SSO authentication failed' }));
    throw new Error(error.detail || `SSO authentication failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Remove cached Google auth token (for logout or retry)
 */
export async function removeCachedGoogleToken(): Promise<void> {
  return new Promise((resolve) => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (token) {
        chrome.identity.removeCachedAuthToken({ token }, () => {
          resolve();
        });
      } else {
        resolve();
      }
    });
  });
}

// ============== Main Auth Flow ==============

/**
 * Initialize authentication
 * Priority:
 * 1. Chrome Enterprise Policy (managed storage)
 * 2. Stored credentials (local storage)
 * 3. Need manual setup
 */
export async function initializeAuth(): Promise<AuthState> {
  console.log('[Niyantra] Initializing authentication...');

  // Check for Chrome Enterprise policy first
  const policy = await getManagedPolicy();

  if (policy?.serverUrl && policy?.tenantToken) {
    console.log('[Niyantra] Found Chrome Enterprise policy');

    // Authenticate with tenant token
    try {
      const tenantAuth = await authenticateWithTenantToken(
        policy.serverUrl,
        policy.tenantToken
      );

      if (tenantAuth.success) {
        // Check if SSO is required
        if (tenantAuth.sso_enabled && policy.authMode === 'sso') {
          // Need SSO login
          return {
            isConfigured: true,
            authMode: 'policy',
            serverUrl: policy.serverUrl,
            tenantToken: policy.tenantToken,
            tenantName: tenantAuth.tenant_name,
            enforcementMode: tenantAuth.enforcement_mode as 'enforce' | 'log_only',
            ssoProvider: tenantAuth.sso_provider,
            needsSSOLogin: true,
          };
        }

        // Policy-only mode (no user authentication required)
        // Store the policy config
        await storageSet({
          serverUrl: policy.serverUrl,
          tenantToken: policy.tenantToken,
          tenantName: tenantAuth.tenant_name,
          enforcementMode: tenantAuth.enforcement_mode,
          authMode: 'policy',
        });

        return {
          isConfigured: true,
          authMode: 'policy',
          serverUrl: policy.serverUrl,
          tenantToken: policy.tenantToken,
          tenantName: tenantAuth.tenant_name,
          enforcementMode: tenantAuth.enforcement_mode as 'enforce' | 'log_only',
          needsSSOLogin: false,
        };
      }
    } catch (error) {
      console.error('[Niyantra] Policy authentication failed:', error);
    }
  }

  // Check for stored credentials
  const stored = await storageGet([
    'serverUrl',
    'apiKey',
    'tenantName',
    'userEmail',
    'enforcementMode',
    'authMode',
  ]);

  if (stored.serverUrl && stored.apiKey) {
    return {
      isConfigured: true,
      authMode: stored.authMode || 'manual',
      serverUrl: stored.serverUrl,
      apiKey: stored.apiKey,
      tenantName: stored.tenantName,
      userEmail: stored.userEmail,
      enforcementMode: stored.enforcementMode || 'enforce',
      needsSSOLogin: false,
    };
  }

  // Not configured
  return {
    isConfigured: false,
    authMode: 'manual',
    enforcementMode: 'enforce',
    needsSSOLogin: false,
  };
}

/**
 * Complete SSO login flow
 */
export async function completeSSOLogin(
  serverUrl: string,
  tenantToken: string,
  ssoProvider: string
): Promise<AuthState> {
  if (ssoProvider !== 'google') {
    throw new Error(`SSO provider '${ssoProvider}' not yet supported`);
  }

  // Get Google auth token
  const accessToken = await getGoogleAuthToken(true);

  // Authenticate with backend
  const ssoAuth = await authenticateWithGoogleSSO(
    serverUrl,
    tenantToken,
    accessToken
  );

  if (!ssoAuth.success) {
    throw new Error(ssoAuth.message || 'SSO authentication failed');
  }

  // Store credentials
  await storageSet({
    serverUrl,
    apiKey: ssoAuth.api_key,
    tenantToken,
    tenantName: ssoAuth.tenant_name,
    userEmail: ssoAuth.user_email,
    enforcementMode: ssoAuth.enforcement_mode,
    authMode: 'sso',
  });

  return {
    isConfigured: true,
    authMode: 'sso',
    serverUrl,
    apiKey: ssoAuth.api_key,
    tenantToken,
    tenantName: ssoAuth.tenant_name,
    userEmail: ssoAuth.user_email,
    enforcementMode: ssoAuth.enforcement_mode as 'enforce' | 'log_only',
    ssoProvider,
    needsSSOLogin: false,
  };
}

/**
 * Logout / clear credentials
 */
export async function logout(): Promise<void> {
  // Remove cached Google token if SSO
  await removeCachedGoogleToken();

  // Clear local storage (but keep policy-based config)
  await storageRemove([
    'apiKey',
    'userEmail',
  ]);
}

/**
 * Check if using enterprise policy
 */
export async function isEnterpriseManaged(): Promise<boolean> {
  try {
    const policy = await getManagedPolicy();
    return !!(policy?.serverUrl && policy?.tenantToken);
  } catch {
    return false;
  }
}
