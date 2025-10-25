/**
 * Site-specific configurations for AI chat platforms
 * Contains selectors and methods to interact with each site's DOM
 */

export interface SiteConfig {
  /** Human-readable name of the site */
  name: string;
  /** CSS selector for the message input textarea */
  textarea: string;
  /** CSS selector for the submit button */
  submitButton: string;
  /** Function to extract text from the textarea element */
  getMessageText: (element: HTMLElement) => string;
  /** Function to check if element is ready (optional) */
  isReady?: () => boolean;
}

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
    isReady: () => {
      return !!document.querySelector('rich-textarea');
    },
  },

  // Perplexity AI
  'www.perplexity.ai': {
    name: 'Perplexity',
    textarea: '#ask-input, div[role="textbox"][contenteditable="true"]',
    submitButton: 'button[data-testid="submit-button"]',
    getMessageText: (element: HTMLElement) => {
      // Perplexity uses Lexical editor (contenteditable div)
      return element.innerText || element.textContent || '';
    },
    isReady: () => {
      return !!document.querySelector('#ask-input');
    },
  },

  // Groq
  'chat.groq.com': {
    name: 'Groq',
    textarea: 'textarea#chat',
    submitButton: 'button[type="submit"]',
    getMessageText: (element: HTMLElement) => {
      if (element instanceof HTMLTextAreaElement) {
        return element.value;
      }
      return element.textContent || '';
    },
    isReady: () => {
      return !!document.querySelector('textarea#chat');
    },
  },
};

/**
 * Get configuration for the current site
 */
export function getCurrentSiteConfig(): SiteConfig | null {
  const hostname = window.location.hostname;
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
