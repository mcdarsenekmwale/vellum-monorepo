import { test, expect } from "@playwright/test";

test("language switching smoke test", async ({ page }) => {
  await page.goto("/settings");
  await page.waitForTimeout(2000);

  // ── Switch to French ──
  // Look for the Language row and tap it
  const langRow = page.locator("text=/Language|Langue|Sprache|Idioma/i").first();
  await langRow.click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1000);

  // Click Français
  await page.locator("text=Français").first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1500);

  // Verify French text
  const frText = await page.locator("body").textContent();
  expect(frText).toMatch(/Paramètres|Apparence|Langue|Préférences/i);

  // ── Switch to German ──
  await page.locator("text=/Sprache|Language/i").first().click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await page.locator("text=Deutsch").first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const deText = await page.locator("body").textContent();
  expect(deText).toMatch(/Einstellungen|Erscheinungsbild|Sprache|Präferenzen/i);

  // ── Switch to Spanish ──
  await page.locator("text=/Sprache|Language|Idioma/i").first().click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await page.locator("text=Español").first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const esText = await page.locator("body").textContent();
  expect(esText).toMatch(/Configuración|Apariencia|Idioma|Preferencias/i);

  // ── Switch back to English ──
  await page.locator("text=/Idioma|Language|Sprache/i").first().click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await page.locator("text=English").first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const enText = await page.locator("body").textContent();
  expect(enText).toMatch(/Settings|Appearance|Language|Preferences/i);
});
