# Contributing to GuardFlow

Thank you for your interest in contributing to GuardFlow! We welcome contributions of all kinds - whether it's bug reports, feature requests, documentation improvements, or code contributions.

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md) to keep our community respectful and inclusive.

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Git
- A GitHub account

### Setup Development Environment

1. **Fork the repository**
   - Visit https://github.com/deepakk5893/guardflow-extension
   - Click the "Fork" button in the top right

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/guardflow-extension.git
   cd guardflow-extension
   ```

3. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/deepakk5893/guardflow-extension.git
   ```

4. **Install dependencies**
   ```bash
   npm install
   ```

5. **Start development**
   ```bash
   npm run dev
   ```

### Testing Locally

```bash
# Run automated tests
npm test

# Run tests in watch mode
npm test:watch

# Build for testing in Chrome
npm run build

# Load in Chrome:
# 1. Open chrome://extensions/
# 2. Enable Developer Mode
# 3. Click "Load unpacked"
# 4. Select the dist/ folder
```

---

## Types of Contributions

### 1. Bug Reports

Found a bug? Please create an issue with:

- **Title**: Clear, descriptive title
- **Description**: What happened and what you expected
- **Steps to Reproduce**: Exact steps to reproduce the issue
- **Screenshots**: If applicable
- **Environment**:
  - OS (Windows, macOS, Linux)
  - Chrome version
  - GuardFlow version

**Example:**
```
Title: False negative for OpenAI API key in code comment

Description:
GuardFlow didn't detect an OpenAI API key when pasted as a comment in code.

Steps to Reproduce:
1. Paste this to ChatGPT:
   // OpenAI key: sk-proj-ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnop
2. Expected warning dialog, but no warning appeared

Environment:
- OS: macOS
- Chrome: 130.0.0.0
- GuardFlow: 1.0.0
```

### 2. Feature Requests

Have an idea? Open an issue with:

- **Title**: Clear feature description
- **Motivation**: Why is this useful?
- **Proposed Solution**: How would it work?
- **Alternative Solutions**: Any other approaches?

**Example:**
```
Title: Add support for HashiCorp Vault tokens

Motivation:
Many developers use Terraform with HashiCorp Vault.
Would be good to detect Vault tokens to prevent leaks.

Proposed Solution:
Add pattern for HashiCorp Vault tokens (format: hvs.*)

Alternative Solutions:
Could also warn on generic HVAC_ADDR environment variables.
```

### 3. Code Contributions

#### Small Changes (Bug Fixes, Documentation)

1. **Create a branch**
   ```bash
   git checkout -b fix/your-fix-name
   ```

2. **Make your changes**

3. **Test your changes**
   ```bash
   npm test
   npm run build
   ```

4. **Commit**
   ```bash
   git commit -m "fix: brief description of what you fixed"
   ```

5. **Push and create PR**
   ```bash
   git push origin fix/your-fix-name
   ```
   Then create a Pull Request on GitHub

#### Large Changes (New Features, Refactoring)

1. **Open an issue first** to discuss the approach
   - Get feedback before investing time
   - Ensure alignment with project goals

2. **Follow the process above** once approved

### 4. New Secret Detection Patterns

Adding new secret patterns? Here's the process:

#### Step 1: Propose the Pattern

Create an issue with:
- **Secret Type**: What kind of secret?
- **Real-world Example**: Actual format (sanitized)
- **Pattern Regex**: Proposed regex pattern
- **False Positive Risk**: Could it match non-secrets?
- **Prevalence**: How often do people leak this?

#### Step 2: Add the Pattern

Location: `src/utils/secretDetection.ts`

```typescript
{
  id: 'example-token',
  type: 'Example Service Token',
  pattern: /\bexample_[A-Za-z0-9]{20,}\b/g,
  severity: 'error',
  message: 'Example Service Token detected',
},
```

#### Step 3: Add Tests

Location: `src/utils/secretDetection.test.ts`

```typescript
it('detects Example Service Token', async () => {
  const text = 'My token: example_1a2b3c4d5e6f7g8h9i0j1k2l';
  const result = await detectSecrets(text);
  expect(result.hasSecrets).toBe(true);
  expect(result.count).toBeGreaterThan(0);
});
```

#### Step 4: Test Manually

Add test scenario to `secret_leaks_scenario.txt` with a realistic context.

#### Step 5: Submit PR

Include:
- The regex pattern
- Test case
- Real-world scenario
- Justification for the pattern

---

## Commit Message Guidelines

Follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `test`: Tests
- `refactor`: Refactoring
- `perf`: Performance improvements
- `chore`: Build, dependencies, etc.

### Examples
```
feat(detection): add Vault token pattern

fix(dialog): prevent double submission on slow networks

docs: update README with new screenshots

test(utils): improve coverage for AWS patterns

refactor(content): simplify site-specific selector logic
```

---

## Pull Request Process

1. **Before submitting:**
   - Run `npm test` - all tests must pass
   - Run `npm run build` - build must succeed
   - Update README if needed
   - Add test cases if adding features

2. **PR Title**: Use the same format as commit messages
   ```
   feat(detection): add Vault token pattern
   ```

3. **PR Description**: Include:
   - What changed and why
   - How to test
   - Breaking changes (if any)
   - Closes #123 (if fixing an issue)

4. **Wait for review**
   - Maintainers will review within 1-2 days
   - Address feedback with new commits
   - Don't force-push unless requested

### Example PR Description

```markdown
## Changes
Added detection pattern for HashiCorp Vault tokens in the format `hvs.*`

## Type of Change
- [x] New feature (non-breaking)
- [ ] Bug fix
- [ ] Breaking change
- [ ] Documentation update

## Testing
- Added 2 new test cases in `secretDetection.test.ts`
- Tested against real Vault token formats
- Manual testing on ChatGPT shows correct detection

## Screenshots (if applicable)
[Screenshots of the warning dialog]

## Closes
Closes #42
```

---

## Code Style

### TypeScript
- Use `const` and `let` (not `var`)
- Prefer `interface` over `type`
- Always add type annotations
- Use meaningful variable names

### Formatting
- 2-space indentation
- 80-character line limit for readability
- Single quotes for strings

### Example
```typescript
interface SecretRule {
  id: string;
  type: string;
  pattern: RegExp;
  severity: 'error' | 'warning';
  message: string;
}

const rule: SecretRule = {
  id: 'example-token',
  type: 'Example Token',
  pattern: /\bexample_[A-Za-z0-9]{20,}\b/g,
  severity: 'error',
  message: 'Example token detected',
};
```

---

## Performance Considerations

When adding new patterns:

1. **Test pattern performance**
   ```bash
   npm test -- --testNamePattern="detects"
   ```

2. **Keep regex efficient**
   - Avoid catastrophic backtracking
   - Use character classes `[a-z]` not alternatives `(a|b|c)`
   - Anchor patterns with `\b` (word boundaries)

3. **Order patterns by frequency**
   - High-frequency patterns first
   - Move new pattern if common

---

## Documentation

### README Updates
Keep the README up-to-date with:
- New features
- New platforms
- Breaking changes

### Code Comments
Add comments for:
- Complex regex patterns
- Non-obvious logic
- Important edge cases

### Example
```typescript
// GitHub Fine-Grained PAT format: 82 alphanumeric + underscore chars
// Matches: github_pat_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
pattern: /\bgithub_pat_[A-Za-z0-9_]{82}\b/g,
```

---

## Questions or Need Help?

- 📖 Check the [README](README.md)
- 🐛 Search [existing issues](https://github.com/deepakk5893/guardflow-extension/issues)
- 💬 Open a [discussion](https://github.com/deepakk5893/guardflow-extension/discussions)
- 📧 Contact: deepakk5893 on GitHub

---

## Recognition

Contributors will be recognized in:
- This CONTRIBUTING.md file
- GitHub contributors page
- Release notes

Thank you for making GuardFlow better! ❤️
