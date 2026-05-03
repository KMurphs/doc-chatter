import { test, expect, Page } from '@playwright/test';

// --- Helpers ---
async function setLocalSettings(page: Page, overrides: Record<string, unknown> = {}) {
  const settings = {
    storageMode: 'local',
    chatProvider: 'bedrock',
    bedrockRegion: 'us-east-1',
    bedrockModelId: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    triggerWord: 'send',
    silenceTimeout: 2,
    ttsSpeed: 1.1,
    darkMode: false,
    renderMarkdown: true,
    providerUrl: '',
    providerToken: '',
    providerModelId: '',
    ...overrides,
  };
  await page.goto('/');
  await page.evaluate((s) => localStorage.setItem('doc-chatter-app-settings', JSON.stringify(s)), settings);
}

async function createLocalSession(page: Page, title: string, paperText = 'Test paper content.') {
  await page.goto('/sessions/new');
  await page.getByRole('textbox', { name: 'Paste the paper text here...' }).fill(paperText);
  await page.getByRole('textbox', { name: 'Auto-generated from paper' }).fill(title);
  await page.getByRole('button', { name: 'Start Session' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
}

// ============================================================
// Empty page
// ============================================================
test.describe('Empty page', () => {
  test('shows welcome message and new session button in local mode', async ({ page }) => {
    await setLocalSettings(page);
    await page.goto('/');
    await expect(page.getByText('doc-chatter').first()).toBeVisible();
    await expect(page.getByText('Paste a research paper')).toBeVisible();
    await expect(page.getByRole('button', { name: '+ New session' })).toBeVisible();
    await expect(page.getByRole('button', { name: '⚙️ Settings' }).first()).toBeVisible();
  });

  test('sidebar has no markdown button when no session is active', async ({ page }) => {
    await setLocalSettings(page);
    await page.goto('/');
    await expect(page.getByText('Markdown')).not.toBeVisible();
  });
});

// ============================================================
// Session CRUD (local storage)
// ============================================================
test.describe('Local session CRUD', () => {
  test('create session and navigate to chat', async ({ page }) => {
    await setLocalSettings(page);
    await createLocalSession(page, 'Test Paper', 'Quantum computing uses qubits.');
    await expect(page).toHaveURL(/\/sessions\/[a-f0-9-]+/);
    await expect(page.getByText('Ask your first question')).toBeVisible();
  });

  test('session appears in sidebar after creation', async ({ page }) => {
    await setLocalSettings(page);
    await createLocalSession(page, 'Sidebar Test');
    await expect(page.getByRole('link', { name: /Sidebar Test/ })).toBeVisible();
  });

  test('markdown button shows when session is active', async ({ page }) => {
    await setLocalSettings(page);
    await createLocalSession(page, 'MD Test');
    await expect(page.getByText('Markdown')).toBeVisible();
  });
});

// ============================================================
// Settings panel
// ============================================================
test.describe('Settings panel', () => {
  test('opens and shows voice settings', async ({ page }) => {
    await setLocalSettings(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Settings' }).first().click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.getByText('Trigger word')).toBeVisible();
    await expect(page.getByText('Silence timeout')).toBeVisible();
    await expect(page.getByText('Speech speed')).toBeVisible();
  });

  test('advanced section shows axis dropdowns', async ({ page }) => {
    await setLocalSettings(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Settings' }).first().click();
    await page.getByRole('button', { name: /Advanced/ }).click();
    await expect(page.getByText('Session storage', { exact: true })).toBeVisible();
    await expect(page.getByText('Inference provider', { exact: true })).toBeVisible();
    await expect(page.getByText('Voice provider', { exact: true })).toBeVisible();
  });

  test('switching inference provider shows different config fields', async ({ page }) => {
    await setLocalSettings(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Settings' }).first().click();
    await page.getByRole('button', { name: /Advanced/ }).click();

    // Bedrock is default — should show Region and Model ID
    await expect(page.getByText('Region')).toBeVisible();

    // Switch to generic
    await page.locator('select').nth(1).selectOption('generic');
    await expect(page.getByText('Endpoint URL')).toBeVisible();
    await expect(page.getByText('API Key', { exact: true })).toBeVisible();
  });

  test('cancel discards changes', async ({ page }) => {
    await setLocalSettings(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Settings' }).first().click();
    await page.getByRole('button', { name: /Advanced/ }).click();
    await page.locator('select').nth(1).selectOption('generic');
    await page.getByRole('button', { name: 'Cancel' }).click();

    const provider = await page.evaluate(() => {
      const s = localStorage.getItem('doc-chatter-app-settings');
      return s ? JSON.parse(s).chatProvider : null;
    });
    expect(provider).toBe('bedrock');
  });

  test('save persists changes', async ({ page }) => {
    await setLocalSettings(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Settings' }).first().click();
    await page.getByRole('button', { name: /Advanced/ }).click();
    await page.locator('select').nth(1).selectOption('generic');
    await page.getByRole('button', { name: 'Save' }).click();

    const provider = await page.evaluate(() => {
      const s = localStorage.getItem('doc-chatter-app-settings');
      return s ? JSON.parse(s).chatProvider : null;
    });
    expect(provider).toBe('generic');
  });
});

// ============================================================
// Chat (local + bedrock) — requires valid AWS credentials
// ============================================================
test.describe('Chat with Bedrock', () => {
  test.skip(!process.env.TEST_BEDROCK, 'Set TEST_BEDROCK=1 with valid Cognito session to run');

  test('send message and receive response', async ({ page }) => {
    await setLocalSettings(page);
    await createLocalSession(page, 'Bedrock Test', 'Quantum computers use qubits. Unlike classical bits, qubits can be in superposition.');

    await page.getByRole('textbox', { name: 'Ask about the paper...' }).fill('What is a qubit?');
    await page.getByRole('textbox', { name: 'Ask about the paper...' }).press('Enter');

    // Wait for response (Bedrock can take 10-15s)
    await expect(page.locator('button:has-text("🔊")').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('What is a qubit?')).toBeVisible();
  });
});

// ============================================================
// Error handling
// ============================================================
test.describe('Error handling', () => {
  test('shows error banner with copy button on chat failure', async ({ page }) => {
    await setLocalSettings(page, { chatProvider: 'generic', providerUrl: 'https://invalid.example.com/chat', providerToken: 'fake' });
    await createLocalSession(page, 'Error Test');

    await page.getByRole('textbox', { name: 'Ask about the paper...' }).fill('hello');
    await page.getByRole('textbox', { name: 'Ask about the paper...' }).press('Enter');

    await expect(page.locator('text=📋')).toBeVisible({ timeout: 10_000 });
  });
});
