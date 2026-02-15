/**
 * Shadow AI Warning Banner
 *
 * Content script that runs on ALL pages to check if the current site
 * is in the Shadow AI list with "warn" action, and shows a dismissible banner.
 */

// Types
interface ShadowAISite {
  domain: string;
  name: string;
  category: string;
  action: 'block' | 'warn' | 'log' | 'allow';
  risk_level: string;
}

// Banner ID for checking if already injected
const BANNER_ID = 'niyantra-shadow-ai-banner';

// Storage key to remember dismissed banners (per session)
const DISMISSED_KEY = 'niyantra-shadow-ai-dismissed';

/**
 * Check if banner was already dismissed for this domain in this session
 */
async function wasDismissed(domain: string): Promise<boolean> {
  try {
    const result = await chrome.storage.session?.get(DISMISSED_KEY);
    const dismissed = result?.[DISMISSED_KEY] || [];
    return dismissed.includes(domain);
  } catch {
    // session storage might not be available
    return false;
  }
}

/**
 * Mark domain as dismissed for this session
 */
async function markDismissed(domain: string): Promise<void> {
  try {
    const result = await chrome.storage.session?.get(DISMISSED_KEY);
    const dismissed = result?.[DISMISSED_KEY] || [];
    if (!dismissed.includes(domain)) {
      dismissed.push(domain);
      await chrome.storage.session?.set({ [DISMISSED_KEY]: dismissed });
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Format category for display
 */
function formatCategory(category: string): string {
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Inject warning banner into the page
 */
function injectWarningBanner(site: ShadowAISite): void {
  // Check if already injected
  if (document.getElementById(BANNER_ID)) {
    return;
  }

  // Create banner container
  const banner = document.createElement('div');
  banner.id = BANNER_ID;

  // Use shadow DOM to isolate styles
  const shadow = banner.attachShadow({ mode: 'closed' });

  // Banner styles
  const styles = document.createElement('style');
  styles.textContent = `
    .banner {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      color: white;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      z-index: 2147483647;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      animation: slideDown 0.3s ease-out;
    }

    @keyframes slideDown {
      from {
        transform: translateY(-100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    .content {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
    }

    .icon {
      font-size: 22px;
      flex-shrink: 0;
    }

    .text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .title {
      font-weight: 600;
      font-size: 14px;
    }

    .subtitle {
      font-size: 12px;
      opacity: 0.9;
    }

    .category {
      background: rgba(255, 255, 255, 0.2);
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-left: 8px;
    }

    .actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .btn {
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s ease;
      font-family: inherit;
    }

    .btn:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .btn-dismiss {
      background: rgba(0, 0, 0, 0.2);
      border-color: rgba(0, 0, 0, 0.1);
    }

    .btn-dismiss:hover {
      background: rgba(0, 0, 0, 0.3);
    }

    .powered-by {
      font-size: 10px;
      opacity: 0.7;
      margin-left: 12px;
    }

    @media (max-width: 768px) {
      .banner {
        flex-direction: column;
        gap: 12px;
        text-align: center;
        padding: 16px;
      }

      .content {
        flex-direction: column;
      }

      .actions {
        width: 100%;
        justify-content: center;
      }

      .powered-by {
        margin-left: 0;
        margin-top: 8px;
      }
    }
  `;

  // Banner HTML
  const bannerHTML = document.createElement('div');
  bannerHTML.className = 'banner';
  bannerHTML.innerHTML = `
    <div class="content">
      <span class="icon">⚠️</span>
      <div class="text">
        <span class="title">
          <strong>${escapeHtml(site.name)}</strong> is an unauthorized AI tool
          <span class="category">${escapeHtml(formatCategory(site.category))}</span>
        </span>
        <span class="subtitle">Using this may expose sensitive company data. Proceed with caution.</span>
      </div>
    </div>
    <div class="actions">
      <button class="btn btn-dismiss" id="dismiss-btn">Dismiss</button>
      <span class="powered-by">Protected by Niyantra</span>
    </div>
  `;

  // Add to shadow DOM
  shadow.appendChild(styles);
  shadow.appendChild(bannerHTML);

  // Add to page
  document.documentElement.prepend(banner);

  // Push body content down
  document.body.style.marginTop = '56px';
  document.body.style.transition = 'margin-top 0.3s ease';

  // Dismiss handler
  const dismissBtn = shadow.getElementById('dismiss-btn');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', async () => {
      // Animate out
      bannerHTML.style.animation = 'slideDown 0.2s ease-out reverse';

      // Wait for animation
      setTimeout(() => {
        banner.remove();
        document.body.style.marginTop = '';
      }, 200);

      // Mark as dismissed for this session
      await markDismissed(site.domain);

      // Log dismissal to server
      try {
        chrome.runtime.sendMessage({
          type: 'LOG_SHADOW_AI',
          domain: site.domain,
          action: 'warn_dismissed',
        });
      } catch {
        // Ignore errors
      }
    });
  }

  console.log('[Niyantra] Shadow AI warning banner shown for:', site.domain);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Main function - check current site and show banner if needed
 */
async function checkAndShowBanner(): Promise<void> {
  try {
    // Don't run on extension pages
    if (window.location.protocol === 'chrome-extension:' ||
        window.location.protocol === 'moz-extension:') {
      return;
    }

    // Check with background script if this is a Shadow AI site
    const result = await chrome.runtime.sendMessage({
      type: 'CHECK_SHADOW_AI',
      url: window.location.href,
    }) as ShadowAISite | null;

    // Only show banner for "warn" action
    if (!result || result.action !== 'warn') {
      return;
    }

    // Check if already dismissed this session
    if (await wasDismissed(result.domain)) {
      return;
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        injectWarningBanner(result);
      });
    } else {
      injectWarningBanner(result);
    }
  } catch (error) {
    // Silently fail - don't break the page
    console.warn('[Niyantra] Shadow AI banner check failed:', error);
  }
}

// Run check
checkAndShowBanner();

// Also check on navigation within SPAs
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    // Remove existing banner
    const existingBanner = document.getElementById(BANNER_ID);
    if (existingBanner) {
      existingBanner.remove();
      document.body.style.marginTop = '';
    }
    // Check new URL
    checkAndShowBanner();
  }
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
});
