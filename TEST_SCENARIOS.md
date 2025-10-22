# Guardflow Secret Detection - Test Scenarios

Comprehensive test cases for all 53 secret detection patterns.

---

## Category 1: AWS Secrets

### AWS Access Key
```
I'm getting auth errors with my AWS CLI:
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

### AWS Secret Key (Alternative Format)
```
aws_secret_access_key = 'abc123DEF456ghi789JKL012mno345PQR678stu901'
```

---

## Category 2: GitHub & Git Secrets

### GitHub Personal Access Token (PAT)
```
My GitHub token: ghp_A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8
```

### GitHub OAuth Token
```
OAuth token: gho_16C7e42F292c6912E7710c838347Ae178B4a
```

### GitHub User-to-Server Token
```
User token: ghu_1B4a2e77838347a7E420F8c1A1F0b2C3d4E5F6G
```

### GitHub Server-to-Server Token
```
App token: ghs_1A2b3C4d5E6f7G8h9I0j1K2l3M4n5O6p7Q8r9S0t
```

### GitHub Refresh Token
```
Refresh token: ghr_1A2b3C4d5E6f7G8h9I0j1K2l3M4n5O6p7Q8r9S0t
```

### GitLab Personal Access Token
```
GitLab token: glpat-Xk7Y8Z9a0B1c2D3e4F5g6
```

### GitHub Fine-Grained Personal Access Token
```
GitHub fine-grained: github_pat_A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6a7b8c9d0e1f2g3h4i5j6k7l8m9n
```

---

## Category 3: Private Keys & Authentication

### SSH Private Key (PEM Format)
```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKj
...
-----END PRIVATE KEY-----
```

### SSH Private Key (RSA Format)
```
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA4f5wg5l2hKsTeNem/V41fGnJm6gOdrj8ym3rFkEU/wT8RDtn
...
-----END RSA PRIVATE KEY-----
```

### JWT Token
```
Getting 403 error with token:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NTY3ODkwIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

### Basic Auth in URL
```
curl -X GET http://admin:P@ssw0rd123@api.example.com/users
```

---

## Category 4: API Keys - Cloud Providers

### Google Cloud API Key
```
My GCP config:
apiKey: "AIzaSyBCDEF123456789-abcdefGHIJKLMNOPQRST"
```

### Google Gemini API Key
```
Gemini token: AIzaSyDdVgKwhJ2sdfskhfksjhd12345fsdjfs
```

### Azure Storage SAS Token
```
Storage URL: https://storage.azure.com?sv=2023-01-01&ss=b&srt=sco
```

### Google OAuth Client Secret
```
{
  "client_id": "123456789.apps.googleusercontent.com",
  "client_secret": "GOCSPX-abc123def456ghi789jkl012mno"
}
```

---

## Category 5: API Keys - AI/LLM Providers

### OpenAI API Key (User)
```
I'm using this OpenAI key: sk-ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnop
```

### OpenAI API Key (Project)
```
My project key: sk-proj-ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz
```

### Anthropic (Claude) API Key
```
Claude API: sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWXYZabc
```

### Groq API Key
```
Groq key: gsk_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p
```

### Hugging Face Token
```
HF token: hf_A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0
```

### Replicate API Token
```
Replicate: r8_A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6
```

### Cohere API Key
```
Cohere: Cka1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9
```

### Mistral API Key
```
Mistral: mistral_sk_A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5
```

### Ollama Token
```
ollama_sk_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p
```

---

## Category 6: Database Credentials

### PostgreSQL Connection String
```
connection string: postgresql://prod_user:kJ8#mP9$xL2@db.prod.company.com:5432/main_db
```

### MySQL Connection String
```
Database URL: mysql://admin:Tr0ub4dor&3@prod-db.internal:3306/maindb
```

### MongoDB Connection String
```
MONGO_URL=mongodb://admin:P@ssw0rd123@mongo:27017/prod
```

### Redis Connection String
```
REDIS_URL=redis://:myRedisP@ss123@redis:6379
```

---

## Category 7: DevOps & CI/CD

### Bitbucket App Password
```
bitbucket_app_pass: bitbucket_ABC123DEF456GHI789JKL012
```

### CircleCI Token
```
circleci_abc123def456ghi789jkl012mno345pqr
```

### Terraform Cloud Token
```
token: atlasv1.A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6
```

### PagerDuty Token
```
PDa1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8s9T0u1
```

---

## Category 8: Communication & Messaging

### Slack Token
```
xoxb-1234567890-1234567890-ABCDEFGHIJKLMNOP
```

### Slack Webhook
```
POST https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
```

### Twilio API Key
```
SK0123456789ABCDEF0123456789ABCD
```

### Mailgun API Key
```
key-0123456789abcdef0123456789abcd
```

---

## Category 9: Infrastructure & Hosting

### Stripe API Key
```
sk_live_51HqB2jKl3m4n5o6p7Q8r9S0t1U2v3W4x5Y6z7A8b9C0d1E2f3
```

### SendGrid API Key
```
SG.1a2b3c4d5e6f7g8h9i0j.A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2
```

### NPM Token
```
npm_A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6
```

### Cloudflare API Token
```
CF1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q
```

### Heroku API Key
```
heroku_A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0
```

### DigitalOcean Token
```
dop_v1_A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6a7b8c9d0e1f2g3h
```

### Docker Registry Personal Access Token
```
Docker PAT: dckr_pat_A1B2C3D4E5F6G7H8I9J0K1L2
```

---

## Category 10: Web3 & Blockchain

### Ethereum Private Key
```
0x1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z7a8b9c0d1e2f3g
```

### Infura API Key
```
https://mainnet.infura.io/v3/0123456789ABCDEF0123456789ABCDEF
```

---

## Category 11: Generic Fallbacks

### Generic API Key Pattern
```
api_key = "A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8"
```

### Password Assignment
```
password: "MyS3cur3P@ssw0rdH3r3!"
```

### Cloud Provider Generic Pattern
```
AWS_SECRET_KEY_PROD=abcdefg123456789
Azure-API-Token=xyz789
```

---

## Test Instructions

### Manual Testing
Copy each scenario and paste into ChatGPT, Claude, Gemini, Perplexity, or Groq. You should see a warning dialog.

### Automated Testing
Run:
```bash
npm test
```

This will verify all regex patterns against their test cases.

---

## Expected Results

All 53 patterns should detect their respective secrets with:
- ✅ 0% false negatives (catches all real examples)
- ✅ <1% false positives (minimal noise)

## Pattern Summary

**Total Detection Patterns: 53**

- AWS: 2
- GitHub & Git: 6 (including fine-grained PAT)
- Private Keys: 4
- Cloud Providers: 4
- AI/LLM: 8
- Databases: 4
- DevOps & CI/CD: 6
- Payment & Communication: 5
- Infrastructure: 6 (including Docker)
- Generic Patterns: 3
- Other: 1
