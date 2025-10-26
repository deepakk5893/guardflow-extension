# Guardflow Secret Detection - Test Scenarios

Comprehensive, realistic test scenarios for all secret detection patterns.

---

## Category 1: AWS Secrets

### Scenario 1.1: AWS Access Key in Error Log
I'm getting this error when trying to connect to AWS:

```
[ERROR] 2025-10-11 10:23:45 - AWS Request failed
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
Region: us-east-1
Service: s3
Error: Access Denied

What am I doing wrong?
```

### Scenario 1.2: AWS Credentials in Python Script
This script is failing, can you help debug?

```python
import boto3

# Production credentials
session = boto3.Session(
    aws_access_key_id='AKIAJ5EXAMPLE2QWERTYY',
    aws_secret_access_key='abc123DEF456ghi789JKL012mno345PQR678stu901',
    region_name='us-west-2'
)

s3 = session.client('s3')
response = s3.list_buckets()

Error: InvalidAccessKeyId
```

---

## Category 2: Database Credentials

### Scenario 2.1: PostgreSQL Connection Error
Hey, I'm getting this error when trying to connect to the database:

```
Error: Connection failed
    at Connection.connect (/app/db.js:45)
    connection string: postgresql://prod_user:kJ8#mP9$xL2@db.prod.company.com:5432/main_db
    at Database.initialize (/app/server.js:12)

How do I fix this?
```

### Scenario 2.2: MongoDB Connection String
My containers aren't starting. Here's the env output:

```yaml
$ docker-compose config
services:
  backend:
    environment:
      DATABASE_URL: mongodb://admin:P@ssw0rd123@mongo:27017/prod
      REDIS_URL: redis://:myRedisP@ss123@redis:6379

What's wrong with my setup?
```

### Scenario 2.3: .env File with Multiple DB Credentials
I think my environment variables are wrong. Here's my .env:

```
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://dbadmin:Tr0ub4dor&3@prod-db.internal:5432/maindb
REDIS_URL=redis://:c@ch3Passw0rd!@redis.internal:6379
SESSION_SECRET=this-is-my-super-secret-session-key-2024

Still getting auth errors!
```

---

## Category 3: Payment & API Keys

### Scenario 3.1: Stripe API Request
Here's the curl command that's failing:

```bash
curl -X POST https://api.stripe.com/v1/charges \
  -H "Authorization: Bearer sk_live_51HqB2jKl3m4n5o6p7Q8r9S0t1U2v3W4x5Y6z7A8b9C0d1E2f3" \
  -d amount=2000 \
  -d currency=usd

Getting 401 error, any ideas?
```

### Scenario 3.2: SendGrid Email Configuration
SendGrid emails aren't going through. Here's my config:

```javascript
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey('SG.1a2b3c4d5e6f7g8h9i0j.A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2');

msg = {
  to: 'user@example.com',
  from: 'noreply@company.com',
  subject: 'Test',
  text: 'Test email'
};

Error: Unauthorized - 401

What am I missing?
```

---

## Category 4: GitHub & Git Tokens

### Scenario 4.1: GitHub Actions CI/CD Failure
My CI pipeline is failing with this output:

```
Run: npm run deploy
Deploying to production...
Using credentials from environment:
  GITHUB_TOKEN=ghp_A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8
  NPM_TOKEN=npm_1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p
  SENTRY_AUTH_TOKEN=sntrys_abc123def456ghi789jkl012mno345pqr678
Error: Deployment failed

Need help debugging this!
```

### Scenario 4.2: GitHub Fine-Grained PAT
I'm setting up my repository with a fine-grained token:

```
GITHUB_TOKEN=github_pat_A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6a7b8c9d0e1f2g3h4i5j6k7l8m9n
```

---

## Category 5: Communication & Webhooks

### Scenario 5.1: Slack Webhook Test
Testing my notification system but it's not working:

```
POST https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
{
  "text": "Test message"
}

Response: 404 Not Found

Is my webhook URL wrong?
```

---

## Category 6: Cloud Provider APIs

### Scenario 6.1: Firebase Configuration
My Firebase app won't initialize. Here's my config:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyBCDEF123456789-abcdefGHIJKLMNOPQRST",
  authDomain: "myapp-prod.firebaseapp.com",
  databaseURL: "https://myapp-prod.firebaseio.com",
  projectId: "myapp-prod",
  storageBucket: "myapp-prod.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};

Getting "Permission denied" error
```

---

## Category 7: Authentication Tokens

### Scenario 7.1: JWT Token in Browser Console
Getting authentication errors. Here's what I see in console:

```javascript
localStorage.getItem('auth_token'):
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NTY3ODkwIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c

API endpoint: /api/v1/users
Response: 403 Forbidden

Why is my token being rejected?
```

---

## Category 8: AI/LLM Provider Keys

### Scenario 8.1: OpenAI API Integration Issues
I'm trying to integrate OpenAI but getting errors:

```javascript
const openai = new OpenAI({
  apiKey: "sk-proj-ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn"
});

const response = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [{ role: "user", content: "Hello" }]
});

Error: 401 Authentication failed

Any ideas?
```

### Scenario 8.2: Anthropic (Claude) API Setup
I'm using Claude API:

```python
from anthropic import Anthropic

client = Anthropic(api_key="sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWXYZabc")

response = client.messages.create(
    model="claude-3-sonnet-20240229",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello Claude!"}]
)

Error: Invalid authentication credentials
```

---

## Category 9: Infrastructure & DevOps

### Scenario 9.1: Kubernetes Secrets Debugging
Trying to debug k8s secrets:

```bash
kubectl get secret app-secrets -o yaml

data:
  api-key: c2stbGl2ZV81MUhxQjJqS2wzbTRuNW82cDdROHI5UzB0MVUydjNXNHg1WTZ6N0E4YjlDMGQxRTJmMw==

Decoded: sk-live_51HqB2jKl3m4n5o6p7Q8r9S0t1U2v3W4x5Y6z7A8b9C0d1E2f3

Why isn't this working in my app?
```

### Scenario 9.2: Environment Variables with Multiple Secrets
Here's my Docker environment dump:

```
STRIPE_SECRET_KEY=sk_live_51Hq2jKl3m4n5o6p7Q8r9S0t1U2v3W4x5Y6z7A8B9C0D1E2F3
SENDGRID_API_KEY=SG.abcdefghijklmnopqrst.ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890
GITHUB_WEBHOOK_SECRET=whsec_1234567890abcdefghijklmnopqrstuvwxyz
OPENAI_API_KEY=sk-ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnop

Services aren't authenticating properly!
```

---

## Category 10: Generic Patterns

### Scenario 10.1: Generic API Key in Config
I'm having trouble with my API integration:

```
api_key = "A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8"
api_secret = "secret_key_abcd1234efgh5678ijkl9012"

Getting 401 errors on all requests
```

### Scenario 10.2: Hardcoded Password in Code
Can someone review this code? I think there's a configuration issue:

```python
config = {
  username: "admin",
  password: "MyS3cur3P@ssw0rdH3r3!",
  host: "db.example.com",
  port: 5432
}

Why isn't authentication working?
```

---

## Testing Instructions

### Manual Testing
1. Copy each scenario and paste it into ChatGPT, Claude, Gemini, Perplexity, or Groq
2. You should see a "GuardFlow Secret Detector" warning dialog
3. Test the three options: Cancel, Edit Message, Send Anyway

### Automated Testing
Run:
```bash
npm test
```

This will verify all regex patterns against their test cases.

### Expected Results
All scenarios should trigger the secret warning dialog with the detected secrets highlighted.

### Test Checklist
- [ ] AWS Access Key detected
- [ ] AWS Secret Key detected
- [ ] Database credentials detected
- [ ] Stripe key detected
- [ ] SendGrid key detected
- [ ] GitHub token detected
- [ ] NPM token detected
- [ ] Slack webhook detected
- [ ] Firebase API key detected
- [ ] JWT token detected
- [ ] OpenAI API key detected
- [ ] Claude API key detected
- [ ] Generic API key detected
- [ ] Password patterns detected
- [ ] Multiple secrets in one message detected

---

## Client Demo Script

"Watch what happens when I accidentally paste debugging logs with secrets..."

[Paste Scenario 2.1 - PostgreSQL Connection Error]

"See? GuardFlow instantly detects the PostgreSQL password in the connection string and stops me before sending it to the AI. This prevents credential leakage."

[Show the warning dialog with detected PostgreSQL secret]

"I can edit the message to remove the secret, or if I really know what I'm doing, I can bypass the warning. This protects your developers while still giving them flexibility."

[Demonstrate Edit and Send Anyway buttons]

"Let's try another one with multiple secrets..."

[Paste Scenario 9.2 - Multiple Environment Variables]

"Notice it detected FOUR secrets in this one message:
- Stripe key (sk_live_...)
- SendGrid key (SG....)
- GitHub webhook secret (whsec_...)
- OpenAI key (sk-...)

GuardFlow catches all of them automatically."

[Show dialog with 4 detected secrets highlighted]
