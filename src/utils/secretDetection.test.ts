import { detectSecrets } from './secretDetection';

describe('Secret Detection - Pattern Tests', () => {
  // AWS Secrets
  describe('AWS Secrets', () => {
    it('detects AWS Access Key', async () => {
      const text = 'My AWS key: AKIAIOSFODNN7EXAMPLE';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(true);
      expect(result.count).toBeGreaterThan(0);
    });

    it('detects AWS Secret Key', async () => {
      const text = 'aws_secret_access_key = abc123DEF456ghi789JKL012mno345PQR678ABCD';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(true);
    });
  });

  // GitHub Secrets
  describe('GitHub Secrets', () => {
    it('detects GitHub Personal Access Token', async () => {
      const text = 'Token: ghp_A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(true);
    });

    it('detects GitHub OAuth Token', async () => {
      const text = 'OAuth: gho_16C7e42F292c6912E7710c838347Ae178B4a';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(true);
    });

    it('detects GitLab Personal Access Token', async () => {
      const text = 'GitLab token: glpat-Xk7Y8Z9a0B1c2D3e4F5g6';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(true);
    });

    it('detects GitHub Fine-Grained Personal Access Token', async () => {
      const text = 'GitHub fine-grained token: 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';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(true);
    });
  });

  // Private Keys
  describe('Private Keys', () => {
    it('detects SSH Private Key (PEM)', async () => {
      const text = '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQE=\n-----END PRIVATE KEY-----';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(true);
    });

    it('detects SSH Private Key (RSA)', async () => {
      const text = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA4f5wg5l2hKsTeNem\n-----END RSA PRIVATE KEY-----';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(true);
    });

    it('detects JWT Token', async () => {
      const text = 'Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NTY3ODkwIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(true);
    });
  });

  // Database Credentials
  describe('Database Credentials', () => {
    it('detects PostgreSQL Connection String', async () => {
      const text = 'postgresql://prod_user:kJ8#mP9$xL2@db.prod.company.com:5432/main_db';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(true);
    });

    it('detects MongoDB Connection String', async () => {
      const text = 'mongodb://admin:P@ssw0rd123@mongo:27017/prod';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(true);
    });

    it('detects Redis Connection String', async () => {
      const text = 'redis://:myRedisP@ss123@redis:6379';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(true);
    });

    it('detects MySQL Connection String', async () => {
      const text = 'mysql://admin:Tr0ub4dor&3@prod-db.internal:3306/maindb';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(true);
    });
  });

  // Cloud Provider Keys
  describe('Cloud Provider Keys', () => {
    it('detects Google Cloud API Key', async () => {
      const text = 'apiKey: AIzaSyBCDEF123456789-abcdefGHIJKLMNOPQRST';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(true);
    });

    it('detects Azure Storage SAS Token', async () => {
      const text = 'https://storage.azure.com?sv=2023-01-01&ss=b&srt=sco';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(true);
    });
  });

  // AI/LLM API Keys
  describe('AI/LLM Provider Keys', () => {
    it('detects OpenAI User API Key', async () => {
      const text = 'OpenAI key: sk-ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnop';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(true);
    });

    it('detects OpenAI Project API Key', async () => {
      const text = 'OpenAI project: sk-proj-ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(true);
    });

    it('detects Anthropic API Key', async () => {
      const text = 'Claude API: sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWXYZabc';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(true);
    });

    it('detects Groq API Key', async () => {
      const text = 'Groq key: gsk_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(true);
    });

    it('detects Hugging Face Token', async () => {
      const text = 'HF token: hf_A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(true);
    });

    it('detects Replicate API Token', async () => {
      const text = 'Replicate: r8_A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(true);
    });

    it('detects Mistral API Key', async () => {
      const text = 'Mistral: mistral_sk_A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(true);
    });
  });

  // Payment & Communication
  describe('Payment & Communication Services', () => {
    it('detects Stripe API Key', async () => {
      const text = 'sk_live_51HqB2jKl3m4n5o6p7Q8r9S0t1U2v3W4x5Y6z7A8b9C0d1E2f3';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(true);
    });

    it('detects SendGrid API Key', async () => {
      const text = 'SG.1a2b3c4d5e6f7g8h9i0j.A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(true);
    });

    it('detects Slack Webhook', async () => {
      const text = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(true);
    });

    it('detects NPM Token', async () => {
      const text = 'npm_A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(true);
    });
  });

  // Infrastructure
  describe('Infrastructure Services', () => {
    it('detects Cloudflare API Token', async () => {
      const text = 'CF1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(true);
    });

    it('detects Heroku API Key', async () => {
      const text = 'heroku_A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(true);
    });

    it('detects DigitalOcean Token', async () => {
      const text = 'dop_v1_A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6a7b8c9d0e1f2g3h';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(true);
    });

    it('detects CircleCI Token', async () => {
      const text = 'circleci_abc123def456ghi789jkl012mno345pqr';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(true);
    });

    it('detects Terraform Cloud Token', async () => {
      const text = 'token: atlasv1.A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(true);
    });

    it('detects Docker Registry Personal Access Token', async () => {
      const text = 'Docker PAT: dckr_pat_A1B2C3D4E5F6G7H8I9J0K1L2';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(true);
    });
  });

  // Generic Patterns
  describe('Generic Patterns', () => {
    it('detects Generic API Key', async () => {
      const text = 'api_key = "A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8"';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(true);
    });

    it('detects Password Assignment', async () => {
      const text = 'password: "MyS3cur3P@ssw0rdH3r3!"';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(true);
    });

    it('does not falsely detect random hex strings (like hashes)', async () => {
      const text = 'SHA256: 1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(false);
    });
  });

  // Edge Cases
  describe('Edge Cases', () => {
    it('returns empty result for clean text', async () => {
      const text = 'This is just normal text with no secrets';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(false);
      expect(result.count).toBe(0);
    });

    it('handles empty input gracefully', async () => {
      const text = '';
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(false);
    });

    it('detects multiple secrets in one message', async () => {
      const text = `
        My AWS key: AKIAIOSFODNN7EXAMPLE
        GitHub token: ghp_A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8
        PostgreSQL: postgresql://user:pass@host:5432/db
      `;
      const result = await detectSecrets(text);
      expect(result.hasSecrets).toBe(true);
      expect(result.count).toBeGreaterThanOrEqual(3);
    });

    it('redacts secrets in preview', async () => {
      const text = 'AKIAIOSFODNN7EXAMPLE is my AWS key';
      const result = await detectSecrets(text);
      if (result.hasSecrets) {
        expect(result.secrets[0].preview).toMatch(/█/);
      }
    });
  });
});
