/**
 * Browser-compatible secret detection using regex patterns
 * Patterns sourced from secretlint, gitleaks, and TruffleHog (all MIT/Apache licensed)
 */

/**
 * Represents a detected secret in the text
 */
export interface DetectedSecret {
  /** Type of secret (e.g., "AWS Access Key", "GitHub Token") */
  type: string;
  /** Position where secret starts */
  index: number;
  /** Length of the secret */
  length: number;
  /** Severity level */
  severity: 'error' | 'warning';
  /** Human-readable message */
  message: string;
  /** Rule ID that detected this secret */
  ruleId: string;
  /** Redacted preview of the secret */
  preview: string;
}

/**
 * Secret detection result
 */
export interface SecretDetectionResult {
  /** Whether any secrets were detected */
  hasSecrets: boolean;
  /** List of detected secrets */
  secrets: DetectedSecret[];
  /** Total count of secrets */
  count: number;
}

/**
 * Secret detection rule
 */
interface SecretRule {
  id: string;
  type: string;
  pattern: RegExp;
  severity: 'error' | 'warning';
  message: string;
}

/**
 * Detection rules based on open-source patterns
 * Sources: secretlint, gitleaks, TruffleHog
 */
const SECRET_RULES: SecretRule[] = [
  // AI/LLM Provider Keys (HIGHEST FREQUENCY - users ask AI about code)
  // OpenAI API Key (User)
  {
    id: 'openai-api-key-user',
    type: 'OpenAI API Key (User)',
    pattern: /\bsk-[A-Za-z0-9\-]{40,}\b/g,
    severity: 'error',
    message: 'OpenAI API Key detected',
  },
  // OpenAI API Key (Project)
  {
    id: 'openai-api-key-project',
    type: 'OpenAI API Key (Project)',
    pattern: /\bsk-proj-[A-Za-z0-9\-_]{48,200}\b/g,
    severity: 'error',
    message: 'OpenAI Project API Key detected',
  },
  // Anthropic API Key (Claude)
  {
    id: 'anthropic-api-key',
    type: 'Anthropic API Key',
    pattern: /\bsk-ant-api\d{2}-[A-Za-z0-9\-_]{20,}\b/g,
    severity: 'error',
    message: 'Anthropic (Claude) API Key detected',
  },

  // Database Connection Strings (VERY HIGH FREQUENCY)
  {
    id: 'database-url',
    type: 'Database URL',
    pattern: /(postgres|postgresql|mysql|mongodb|redis):\/\/[^:]*:[^@]+@[^\s]+/gi,
    severity: 'error',
    message: 'Database Connection String with credentials detected',
  },

  // AWS Keys (VERY HIGH FREQUENCY)
  {
    id: 'aws-access-key',
    type: 'AWS Access Key',
    pattern: /['"]?(AKIA|ASIA|AIPA|AROA)[A-Z0-9]{16}['"]?/g,
    severity: 'error',
    message: 'AWS Access Key detected',
  },
  // AWS Secret Keys (40 chars base64-like, high entropy)
  {
    id: 'aws-secret-key',
    type: 'AWS Secret Key',
    pattern: /aws[_-]?secret[_-]?access[_-]?key[_\"'\s:=]*([A-Za-z0-9/+=]{40})\b/gi,
    severity: 'error',
    message: 'AWS Secret Access Key detected',
  },

  // GitHub Tokens (HIGH FREQUENCY - access issues, CI/CD debugging)
  {
    id: 'github-pat',
    type: 'GitHub Token',
    pattern: /\bghp_[A-Za-z0-9]{36,255}\b/g,
    severity: 'error',
    message: 'GitHub Personal Access Token detected',
  },
  {
    id: 'github-oauth',
    type: 'GitHub Token',
    pattern: /\bgho_[A-Za-z0-9]{36,255}\b/g,
    severity: 'error',
    message: 'GitHub OAuth Token detected',
  },
  {
    id: 'github-user-to-server',
    type: 'GitHub Token',
    pattern: /\bghu_[A-Za-z0-9]{36,255}\b/g,
    severity: 'error',
    message: 'GitHub User-to-Server Token detected',
  },
  {
    id: 'github-server-to-server',
    type: 'GitHub Token',
    pattern: /\bghs_[A-Za-z0-9]{36,255}\b/g,
    severity: 'error',
    message: 'GitHub Server-to-Server Token detected',
  },
  {
    id: 'github-refresh',
    type: 'GitHub Token',
    pattern: /\bghr_[A-Za-z0-9]{36,255}\b/g,
    severity: 'error',
    message: 'GitHub Refresh Token detected',
  },
  {
    id: 'github-fine-grained-pat',
    type: 'GitHub Fine-Grained Token',
    pattern: /\bgithub_pat_[A-Za-z0-9_]{82}\b/g,
    severity: 'error',
    message: 'GitHub Fine-Grained Personal Access Token detected',
  },

  // Stripe & SendGrid (FAIRLY HIGH - payment/email debugging)
  {
    id: 'stripe-key',
    type: 'Stripe API Key',
    pattern: /\b(sk|pk)_(live|test)_[0-9a-zA-Z]{24,99}\b/g,
    severity: 'error',
    message: 'Stripe API Key detected',
  },
  {
    id: 'sendgrid-key',
    type: 'SendGrid API Key',
    pattern: /\bSG\.[A-Za-z0-9_\-]{16,32}\.[A-Za-z0-9_\-]{32,64}\b/g,
    severity: 'error',
    message: 'SendGrid API Key detected',
  },

  // Slack (HIGH - integration debugging)
  {
    id: 'slack-token',
    type: 'Slack Token',
    pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[A-Za-z0-9]{24,32}/g,
    severity: 'error',
    message: 'Slack Token detected',
  },
  {
    id: 'slack-webhook',
    type: 'Slack Webhook',
    pattern: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]{6,}\/B[A-Z0-9]{6,}\/[A-Za-z0-9]{20,}/g,
    severity: 'error',
    message: 'Slack Webhook URL detected',
  },
  // Private Keys (PEM format)
  {
    id: 'private-key',
    type: 'Private Key',
    pattern: /-----BEGIN[A-Z ]*PRIVATE KEY-----/g,
    severity: 'error',
    message: 'Private Key detected',
  },
  // SSH Private Keys (alternative format)
  {
    id: 'ssh-private-key',
    type: 'SSH Private Key',
    pattern: /-----BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY-----/g,
    severity: 'error',
    message: 'SSH Private Key detected',
  },

  // JWT & Auth
  {
    id: 'jwt-token',
    type: 'JWT Token',
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    severity: 'warning',
    message: 'JWT Token detected',
  },
  {
    id: 'basic-auth',
    type: 'Basic Auth',
    pattern: /[a-zA-Z]{3,10}:\/\/[^:\/\s]{3,20}:[^@\/\s]{3,20}@/g,
    severity: 'warning',
    message: 'URL with Basic Authentication credentials detected',
  },
  {
    id: 'password-assignment',
    type: 'Password',
    pattern: /\b(password|passwd|pwd)[\s]*[=:]\s*["']([^"']{8,})["']/gi,
    severity: 'warning',
    message: 'Password in plain text detected',
  },

  // Google API Keys (GCP, Gemini, Firebase)
  {
    id: 'google-api-key',
    type: 'Google API Key',
    pattern: /\bAIza[0-9A-Za-z_\-]{35,}\b/g,
    severity: 'error',
    message: 'Google API Key detected (GCP/Gemini/Firebase)',
  },

  // Other LLM Providers
  // Groq API Key
  {
    id: 'groq-api-key',
    type: 'Groq API Key',
    pattern: /\bgsk_[A-Za-z0-9]{20,}\b/g,
    severity: 'error',
    message: 'Groq API Key detected',
  },
  // Hugging Face Token
  {
    id: 'huggingface-token',
    type: 'Hugging Face Token',
    pattern: /\bhf_[A-Za-z0-9]{30,}\b/g,
    severity: 'error',
    message: 'Hugging Face API Token detected',
  },
  // Replicate API Token
  {
    id: 'replicate-token',
    type: 'Replicate API Token',
    pattern: /\br8_[A-Za-z0-9]{32,}\b/g,
    severity: 'error',
    message: 'Replicate API Token detected',
  },
  // Cohere API Key
  {
    id: 'cohere-api-key',
    type: 'Cohere API Key',
    pattern: /\bC[A-Za-z0-9]{20,}\b/g,
    severity: 'error',
    message: 'Cohere API Key detected',
  },
  // Mistral API Key
  {
    id: 'mistral-api-key',
    type: 'Mistral API Key',
    pattern: /\bmistral_[A-Za-z0-9\-_]{20,}\b/g,
    severity: 'error',
    message: 'Mistral API Key detected',
  },
  // Ollama Local Token
  {
    id: 'ollama-token',
    type: 'Ollama Token',
    pattern: /\bollama_[A-Za-z0-9\-_]{20,}\b/g,
    severity: 'warning',
    message: 'Ollama API Token detected',
  },

  // NPM Token
  {
    id: 'npm-token',
    type: 'NPM Token',
    pattern: /\bnpm_[A-Za-z0-9]{20,}\b/g,
    severity: 'error',
    message: 'NPM Access Token detected',
  },

  // DevOps & Cloud Integration
  // GitLab Personal Access Token
  {
    id: 'gitlab-pat',
    type: 'GitLab Personal Access Token',
    pattern: /\bglpat-[A-Za-z0-9\-_]{20,}\b/g,
    severity: 'error',
    message: 'GitLab Personal Access Token detected',
  },
  // Bitbucket App Password
  {
    id: 'bitbucket-password',
    type: 'Bitbucket App Password',
    pattern: /\bbitbucket_[A-Za-z0-9\-_]{20,}\b/g,
    severity: 'error',
    message: 'Bitbucket App Password detected',
  },
  // CircleCI Token
  {
    id: 'circleci-token',
    type: 'CircleCI Token',
    pattern: /\bcircleci_[A-Za-z0-9\-_]{20,}\b/g,
    severity: 'error',
    message: 'CircleCI API Token detected',
  },
  // Terraform Cloud Token
  {
    id: 'terraform-token',
    type: 'Terraform Cloud Token',
    pattern: /\batlasv1\.[A-Za-z0-9\-_]{20,}\b/g,
    severity: 'error',
    message: 'Terraform Cloud API Token detected',
  },
  // PagerDuty Token
  {
    id: 'pagerduty-token',
    type: 'PagerDuty Token',
    pattern: /\bPD[a-zA-Z0-9]{18,}\b/g,
    severity: 'error',
    message: 'PagerDuty API Token detected',
  },
  // Azure Storage SAS Token
  {
    id: 'azure-sas-token',
    type: 'Azure Storage SAS Token',
    pattern: /sv=202[0-9]-[0-9]{2}-[0-9]{2}&ss=[a-z]&srt=[a-z]/gi,
    severity: 'error',
    message: 'Azure Storage SAS Token detected',
  },
  // Google OAuth Client Secret
  {
    id: 'google-oauth-secret',
    type: 'Google OAuth Client Secret',
    pattern: /"client_secret"\s*:\s*"[A-Za-z0-9\-_]{24,}"/g,
    severity: 'error',
    message: 'Google OAuth Client Secret detected',
  },

  // Payment & Messaging Services
  // Twilio API Key
  {
    id: 'twilio-api-key',
    type: 'Twilio API Key',
    pattern: /\bSK[0-9a-fA-F]{32}\b/g,
    severity: 'error',
    message: 'Twilio API Key detected',
  },
  // Mailgun API Key
  {
    id: 'mailgun-api-key',
    type: 'Mailgun API Key',
    pattern: /\bkey-[0-9a-fA-F]{32}\b/g,
    severity: 'error',
    message: 'Mailgun API Key detected',
  },
  // Cloudflare API Token
  {
    id: 'cloudflare-token',
    type: 'Cloudflare API Token',
    pattern: /\bCF[a-zA-Z0-9\-_]{20,}\b/g,
    severity: 'error',
    message: 'Cloudflare API Token detected',
  },
  // Heroku API Key
  {
    id: 'heroku-api-key',
    type: 'Heroku API Key',
    pattern: /\bheroku_[A-Za-z0-9\-_]{20,}\b/g,
    severity: 'error',
    message: 'Heroku API Key detected',
  },
  // DigitalOcean Token
  {
    id: 'digitalocean-token',
    type: 'DigitalOcean Token',
    pattern: /\bdop_v1_[A-Za-z0-9]{50,}\b/g,
    severity: 'error',
    message: 'DigitalOcean API Token detected',
  },

  // Docker Registry Token
  {
    id: 'docker-registry-token',
    type: 'Docker Registry Token',
    pattern: /\bdckr_pat_[A-Za-z0-9_\-]{20,}\b/g,
    severity: 'error',
    message: 'Docker Registry Personal Access Token detected',
  },
];

/**
 * Redact a secret for display (show first 4-6 chars + masked rest)
 */
const redactSecret = (text: string, index: number, length: number): string => {
  const secret = text.substring(index, index + length);
  const visibleChars = Math.min(6, Math.floor(length * 0.3));
  const visible = secret.substring(0, visibleChars);
  const masked = '█'.repeat(Math.min(16, length - visibleChars));

  return `${visible}${masked}`;
};

/**
 * Detect secrets in the given text using regex patterns
 *
 * @param text - The text to scan for secrets
 * @returns Promise with detection results
 *
 * @example
 * ```ts
 * const result = await detectSecrets("My AWS key is AKIAIOSFODNN7EXAMPLE");
 * if (result.hasSecrets) {
 *   console.log(`Found ${result.count} secret(s)`);
 *   result.secrets.forEach(secret => {
 *     console.log(`${secret.type}: ${secret.preview}`);
 *   });
 * }
 * ```
 */
export async function detectSecrets(text: string): Promise<SecretDetectionResult> {
  if (!text || text.trim().length === 0) {
    return {
      hasSecrets: false,
      secrets: [],
      count: 0,
    };
  }

  const secrets: DetectedSecret[] = [];
  const seenMatches = new Set<string>(); // Avoid duplicate detections

  try {
    // Run all rules against the text
    for (const rule of SECRET_RULES) {
      // Reset regex lastIndex (global flag requires this)
      rule.pattern.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = rule.pattern.exec(text)) !== null) {
        const matchedText = match[0];
        const matchIndex = match.index;

        // Create unique key for this match
        const matchKey = `${rule.id}:${matchIndex}:${matchedText}`;

        // Skip if already detected
        if (seenMatches.has(matchKey)) {
          continue;
        }

        seenMatches.add(matchKey);

        secrets.push({
          type: rule.type,
          index: matchIndex,
          length: matchedText.length,
          severity: rule.severity,
          message: rule.message,
          ruleId: rule.id,
          preview: redactSecret(text, matchIndex, matchedText.length),
        });
      }
    }

    // Sort by index (order in text)
    secrets.sort((a, b) => a.index - b.index);

    return {
      hasSecrets: secrets.length > 0,
      secrets,
      count: secrets.length,
    };
  } catch (error) {
    console.error('Error detecting secrets:', error);
    // Return empty result on error - fail open for UX
    return {
      hasSecrets: false,
      secrets: [],
      count: 0,
    };
  }
}

/**
 * Debounced version of detectSecrets for real-time validation
 * Use this when validating as user types
 */
export function createDebouncedDetector(delayMs: number = 300) {
  let timeoutId: NodeJS.Timeout | null = null;

  return (text: string): Promise<SecretDetectionResult> => {
    return new Promise((resolve) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(async () => {
        const result = await detectSecrets(text);
        resolve(result);
      }, delayMs);
    });
  };
}

/**
 * Check if a specific type of secret is in the list
 */
export function hasSecretType(secrets: DetectedSecret[], type: string): boolean {
  return secrets.some((secret) => secret.type.toLowerCase().includes(type.toLowerCase()));
}

/**
 * Get line number for a secret (useful for error messages)
 */
export function getSecretLine(text: string, secret: DetectedSecret): number {
  const beforeSecret = text.substring(0, secret.index);
  const lineNumber = (beforeSecret.match(/\n/g) || []).length + 1;
  return lineNumber;
}
