# E2E Testing with Playwright

This project uses Playwright for end-to-end testing.

## Setup

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install
```

## Running Tests

```bash
# Run all tests
npm run test:e2e

# Run tests with UI mode
npm run test:e2e:ui

# View test report
npm run test:e2e:report
```

## Test Files

### 1. `auth.spec.ts` - Authentication Flow
- Register new user
- Logout functionality
- Login flow
- Protected route redirection

### 2. `case-flow.spec.ts` - Case Creation & Upload
- Create new case
- Upload multiple images at once
- Verify file preview
- Verify OCR/analysis indicators

### 3. `paywall.spec.ts` - Paywall Enforcement
- FREE user limit enforcement
- Paywall dialog appearance
- Close button (X) functionality
- Direct route access protection
- Backend limit enforcement

### 4. `health.spec.ts` - Health Check (optional)
- Calls Supabase Edge Function `health` when `VITE_SUPABASE_URL` or `SUPABASE_URL` is set
- Skips when env is not set

## Environment Variables

For testing with real users:
```
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=password123
FREE_USER_EMAIL=free@example.com
FREE_USER_PASSWORD=password123
```

## Configuration

See `playwright.config.ts` for:
- Browser configurations
- Base URL settings
- Retry policies
- Screenshot options
