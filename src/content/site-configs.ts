/**
 * Site-specific configurations for AI chat platforms
 * Contains selectors and methods to interact with each site's DOM
 *
 * Architecture: Server-driven configs (Phase 2+) sit ABOVE hardcoded SITE_CONFIGS.
 * Server sends strategy *names* + CSS selectors as JSON; the extension maps
 * strategy names to built-in functions via GETTER_STRATEGIES / SETTER_STRATEGIES.
 */

import { storageGet } from '../utils/storage';

export interface SiteConfig {
  /** Human-readable name of the site */
  name: string;
  /** CSS selector for the message input textarea */
  textarea: string;
  /** CSS selector for the submit button */
  submitButton: string;
  /** Function to extract text from the textarea element */
  getMessageText: (element: HTMLElement) => string;
  /** Function to set text in the textarea element */
  setMessageText?: (element: HTMLElement, text: string) => void;
  /** Function to check if element is ready (optional) */
  isReady?: () => boolean;
}

// ============== Server-Driven Config Types & Strategies ==============

/** JSON-serializable shape returned by the backend */
export interface ServerSiteConfig {
  name: string;
  hostname: string;
  textarea: string;
  submitButton: string;
  getterStrategy: string;
  setterStrategy: string;
  readySelector: string;
  fileInputSelector?: string;
  dropZoneSelector?: string;
}

/** File interceptor selectors from server config */
export interface ServerFileConfig {
  fileInputSelector: string;
  dropZoneSelector: string;
}

// ---- Getter strategies ----

const getter_innerText = (element: HTMLElement): string => {
  return element.innerText || element.textContent || '';
};

const getter_innerText_deep = (element: HTMLElement): string => {
  let text = element.innerText || element.textContent || '';
  if (!text && element.childNodes.length > 0) {
    const textParts: string[] = [];
    element.childNodes.forEach((node) => {
      if (node.nodeType === 3) {
        textParts.push(node.textContent || '');
      } else if (node.nodeType === 1) {
        textParts.push((node as HTMLElement).innerText || (node as HTMLElement).textContent || '');
      }
    });
    text = textParts.join('');
  }
  return text;
};

const GETTER_STRATEGIES: Record<string, (el: HTMLElement) => string> = {
  innerText: getter_innerText,
  innerText_deep: getter_innerText_deep,
};

// ---- Setter strategies ----

const setter_innerText_input = (element: HTMLElement, text: string): void => {
  element.innerText = text;
  element.dispatchEvent(new Event('input', { bubbles: true }));
};

const setter_quill_html = (element: HTMLElement, text: string): void => {
  const editor = element.querySelector('.ql-editor') as HTMLElement;
  if (editor) {
    editor.innerHTML = text.replace(/\n/g, '<br>');
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.dispatchEvent(new Event('change', { bubbles: true }));
  }
};

const SETTER_STRATEGIES: Record<string, ((el: HTMLElement, text: string) => void) | undefined> = {
  innerText_input: setter_innerText_input,
  quill_html: setter_quill_html,
  none: undefined,
};

// ---- Ready strategy (always "selector" — check !!document.querySelector(sel)) ----

function makeReadyFn(readySelector: string): () => boolean {
  return () => !!document.querySelector(readySelector);
}

// ---- Conversion: ServerSiteConfig → SiteConfig ----

/**
 * Convert a server-sent config to a usable SiteConfig.
 * Returns null if the server references an unknown strategy (triggers hardcoded fallback).
 */
function serverConfigToSiteConfig(server: ServerSiteConfig): SiteConfig | null {
  const getter = GETTER_STRATEGIES[server.getterStrategy];
  if (!getter) {
    console.warn(`[Niyantra] Unknown getter strategy "${server.getterStrategy}" for ${server.hostname}, falling back to hardcoded`);
    return null;
  }

  // Setter is optional — "none" maps to undefined
  if (server.setterStrategy !== 'none' && !(server.setterStrategy in SETTER_STRATEGIES)) {
    console.warn(`[Niyantra] Unknown setter strategy "${server.setterStrategy}" for ${server.hostname}, falling back to hardcoded`);
    return null;
  }

  return {
    name: server.name,
    textarea: server.textarea,
    submitButton: server.submitButton,
    getMessageText: getter,
    setMessageText: SETTER_STRATEGIES[server.setterStrategy],
    isReady: makeReadyFn(server.readySelector),
  };
}

// ---- Cached server configs ----

let _cachedServerConfigs: Record<string, ServerSiteConfig> = {};
let _cachedServerVersion: string | null = null;

/**
 * Load server site configs from chrome.storage.local (written by background syncConfig).
 * Safe to call multiple times — just refreshes the cache.
 */
export async function loadServerSiteConfigs(): Promise<void> {
  try {
    const result = await storageGet(['serverConfig']);
    const bundle = result.serverConfig?.site_config_bundle;
    if (!bundle || !Array.isArray(bundle.sites)) {
      return; // No server configs available
    }

    const map: Record<string, ServerSiteConfig> = {};
    for (const site of bundle.sites) {
      if (site.hostname) {
        map[site.hostname] = site;
      }
    }

    _cachedServerConfigs = map;
    _cachedServerVersion = bundle.config_version || null;
    console.log(`[Niyantra] Loaded ${Object.keys(map).length} server site configs (v${_cachedServerVersion})`);
  } catch (e) {
    console.warn('[Niyantra] Failed to load server site configs:', e);
    // Non-fatal — hardcoded fallback will be used
  }
}

/**
 * Get the cached site config version (for heartbeat comparison).
 */
export function getServerConfigVersion(): string | null {
  return _cachedServerVersion;
}

/**
 * Get file interceptor selectors from the cached server config for a hostname.
 * Returns null if no server config or no file selectors available.
 */
export function getServerFileConfig(hostname: string): ServerFileConfig | null {
  const server = _cachedServerConfigs[hostname];
  if (!server || !server.fileInputSelector || !server.dropZoneSelector) {
    return null;
  }
  return {
    fileInputSelector: server.fileInputSelector,
    dropZoneSelector: server.dropZoneSelector,
  };
}

// ============== Hardcoded Site Configs (FALLBACK — never modify or delete) ==============

/**
 * Configuration for supported AI chat sites
 */
export const SITE_CONFIGS: Record<string, SiteConfig> = {
  // ChatGPT (chat.openai.com and chatgpt.com)
  'chat.openai.com': {
    name: 'ChatGPT',
    textarea: '#prompt-textarea',
    submitButton: 'button[data-testid="send-button"], button[data-testid="fruitjuice-send-button"], button[aria-label*="Send"]',
    getMessageText: (element: HTMLElement) => {
      // ChatGPT uses contenteditable div (ProseMirror), not textarea
      // Try innerText first (includes line breaks), then textContent, then get all text recursively
      let text = element.innerText || element.textContent || '';

      // If still empty, try to get text from all child nodes
      if (!text && element.childNodes.length > 0) {
        const textParts: string[] = [];
        element.childNodes.forEach((node) => {
          if (node.nodeType === 3) { // Text node
            textParts.push(node.textContent || '');
          } else if (node.nodeType === 1) { // Element node
            textParts.push((node as HTMLElement).innerText || (node as HTMLElement).textContent || '');
          }
        });
        text = textParts.join('');
      }

      return text;
    },
    setMessageText: (element: HTMLElement, text: string) => {
      // ChatGPT uses ProseMirror contenteditable
      element.innerText = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    },
    isReady: () => {
      return !!document.querySelector('#prompt-textarea');
    },
  },

  'chatgpt.com': {
    name: 'ChatGPT',
    textarea: '#prompt-textarea',
    submitButton: 'button[data-testid="send-button"], button[data-testid="fruitjuice-send-button"], button[aria-label*="Send"]',
    getMessageText: (element: HTMLElement) => {
      // ChatGPT uses contenteditable div (ProseMirror), not textarea
      let text = element.innerText || element.textContent || '';

      // If still empty, try to get text from all child nodes
      if (!text && element.childNodes.length > 0) {
        const textParts: string[] = [];
        element.childNodes.forEach((node) => {
          if (node.nodeType === 3) { // Text node
            textParts.push(node.textContent || '');
          } else if (node.nodeType === 1) { // Element node
            textParts.push((node as HTMLElement).innerText || (node as HTMLElement).textContent || '');
          }
        });
        text = textParts.join('');
      }

      return text;
    },
    setMessageText: (element: HTMLElement, text: string) => {
      // ChatGPT uses ProseMirror contenteditable
      element.innerText = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    },
    isReady: () => {
      return !!document.querySelector('#prompt-textarea');
    },
  },

  // Claude (claude.ai)
  'claude.ai': {
    name: 'Claude',
    textarea: 'div[contenteditable="true"][data-testid="chat-input"]',
    submitButton: 'button[aria-label*="Send"]',
    getMessageText: (element: HTMLElement) => {
      // Claude uses contenteditable div
      return element.innerText || element.textContent || '';
    },
    isReady: () => {
      return !!document.querySelector('div[contenteditable="true"][data-testid="chat-input"]');
    },
  },

  // Google Gemini
  'gemini.google.com': {
    name: 'Gemini',
    textarea: 'rich-textarea',
    submitButton: 'button[aria-label*="Send"]',
    getMessageText: (element: HTMLElement) => {
      // Gemini uses rich-textarea custom element with Quill editor
      return element.innerText || element.textContent || '';
    },
    setMessageText: (element: HTMLElement, text: string) => {
      // Find the contenteditable div inside rich-textarea
      const editor = element.querySelector('.ql-editor') as HTMLElement;
      if (editor) {
        editor.innerHTML = text.replace(/\n/g, '<br>');
        // Trigger input event to notify Gemini
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        editor.dispatchEvent(new Event('change', { bubbles: true }));
      }
    },
    isReady: () => {
      return !!document.querySelector('rich-textarea');
    },
  },

  // Perplexity AI
  'www.perplexity.ai': {
    name: 'Perplexity',
    textarea: '#ask-input, div[role="textbox"][contenteditable="true"]',
    submitButton: 'button[aria-label="Submit"]',
    getMessageText: (element: HTMLElement) => {
      // Perplexity uses Lexical editor (contenteditable div)
      return element.innerText || element.textContent || '';
    },
    isReady: () => {
      return !!document.querySelector('#ask-input');
    },
  },

  // Grok (by xAI) - uses ProseMirror/TipTap contenteditable
  'grok.com': {
    name: 'Grok',
    textarea: 'div.ProseMirror[contenteditable="true"]',
    submitButton: 'button[aria-label="Submit"]',
    getMessageText: (element: HTMLElement) => {
      // Grok uses ProseMirror contenteditable div
      return element.innerText || element.textContent || '';
    },
    isReady: () => {
      return !!document.querySelector('div.ProseMirror[contenteditable="true"]');
    },
  },
};

/**
 * Get configuration for the current site.
 * Priority: server config (cached) → hardcoded SITE_CONFIGS → null
 */
export function getCurrentSiteConfig(): SiteConfig | null {
  const hostname = window.location.hostname;

  // 1. Try server-driven config first
  const serverCfg = _cachedServerConfigs[hostname];
  if (serverCfg) {
    const converted = serverConfigToSiteConfig(serverCfg);
    if (converted) {
      return converted;
    }
    // conversion failed (unknown strategy) — fall through to hardcoded
  }

  // 2. Hardcoded fallback (never removed)
  return SITE_CONFIGS[hostname] || null;
}

/**
 * Wait for the site to be ready
 */
export async function waitForSiteReady(
  config: SiteConfig,
  timeout: number = 10000,
): Promise<boolean> {
  if (!config.isReady) {
    return true; // No ready check defined, assume ready
  }

  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (config.isReady()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}
