import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { questions } from "../src/academy/content.ts";
import { STORAGE_KEY } from "../src/academy/logic.mjs";

// Uses an isolated, disposable browser profile; learning data is never uploaded.
const base = process.env.ACADEMY_URL || "http://127.0.0.1:3000";
if (
  !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base) &&
  base !== "https://ravo-online.onrender.com"
)
  throw Error(
    "Only the local preview or the configured production site is supported.",
  );
const browser = await chromium.launch({
  channel: process.env.ACADEMY_BROWSER || "msedge",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const state = () =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
const navigate = async (name) => {
  await page.getByRole("link", { name, exact: false }).first().click();
};
async function quiz(count, correctCount) {
  for (let i = 0; i < count; i++) {
    const prompt = await page.locator(".question-title").innerText();
    const q = questions.find((x) => x.prompt === prompt);
    assert.ok(q, `Known question: ${prompt}`);
    const answer =
      i < correctCount ? q.correct : q.options.find((a) => a !== q.correct);
    const escaped = answer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    await page
      .getByRole("button", { name: new RegExp(`^[A-C] ${escaped}$`) })
      .click();
    await page
      .getByRole("button", {
        name: i < count - 1 ? "Nächste Frage" : "Test auswerten",
        exact: false,
      })
      .click();
  }
  await expect(page.locator(".quiz-result")).toBeVisible();
}
try {
  await page.goto(base);
  await expect(
    page.getByRole("heading", { name: "Schön, dass du da bist, Patrik." }),
  ).toBeVisible();
  await page.screenshot({ path: ".next/academy-desktop.png", fullPage: true });
  assert.equal((await state()).profiles.Patrik.attempts.length, 0);
  // Every actual Academy subsection URL must survive direct entry and reload.
  for (const [hash, title] of [
    ["dashboard", "Schön, dass du da bist, Patrik."],
    ["path", "Ein Fundament, das bleibt."],
    ["lessons/3", "Kerzen lesen"],
    ["practice", "Dein Übungsbereich"],
    ["tests", "Deine Lernnachweise"],
    ["errors", "Noch einmal. Mit mehr Verständnis."],
    ["rules", "Dein Regelbuch"],
    ["glossary", "Dein Tradinglexikon"],
    ["journal", "Dein Lernjournal"],
    ["settings", "Einstellungen & Datensicherung"],
  ]) {
    await page.goto(`${base}/#${hash}`);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
  }
  await navigate("Dashboard");
  await page.getByRole("button", { name: "Weiterlernen", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Trading verstehen", exact: true }),
  ).toBeVisible();
  assert.deepEqual((await state()).profiles.Patrik.read, []);
  await page
    .getByRole("button", { name: "Trading", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Verstanden", exact: true }).click();
  await page
    .getByRole("button", { name: "Lektion als bearbeitet markieren" })
    .click();
  await expect
    .poll(async () => (await state()).profiles.Patrik.read.length)
    .toBe(1);
  await page.getByRole("button", { name: "Wissen testen · 8 Fragen" }).click();
  await quiz(8, 7);
  await expect(
    page.getByRole("heading", { name: "Wissenstest bestanden" }),
  ).toBeVisible();
  await expect
    .poll(async () => (await state()).profiles.Patrik.attempts.length)
    .toBe(1);
  assert.equal((await state()).profiles.Patrik.attempts[0].score, 87.5);
  assert.equal((await state()).profiles.Patrik.errors.length, 1);
  await navigate("Fehler & Wiederholungen");
  const wrong = (await state()).profiles.Patrik.errors[0];
  const q = questions.find((q) => q.id === wrong.id);
  await page.getByRole("button", { name: q.correct, exact: true }).click();
  await page
    .getByRole("button", { name: "Antwort prüfen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ergebnis speichern & weiter" })
    .click();
  await expect
    .poll(async () => (await state()).profiles.Patrik.errors[0].stage)
    .toBe(1);
  await navigate("Lernjournal");
  await page.getByLabel("Thema *", { exact: true }).fill("OHLC verstanden");
  await page
    .getByLabel("Meine Erkenntnis *", { exact: true })
    .fill("Körper und Spanne sind unterschiedliche Größen.");
  await page
    .getByLabel("Mein nächster Übungsschritt")
    .fill("Drei Kerzen erklären.");
  await page.getByRole("button", { name: "Lernnotiz speichern" }).click();
  await expect(
    page.getByRole("heading", { name: "OHLC verstanden" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Aktives Profil" })
    .selectOption("Fabian");
  await expect(
    page.getByRole("heading", {
      name: "Dein erster Aha-Moment gehört hierhin.",
    }),
  ).toBeVisible();
  assert.equal((await state()).profiles.Fabian.notes.length, 0);
  await page
    .getByRole("combobox", { name: "Aktives Profil" })
    .selectOption("Patrik");
  await expect(
    page.getByRole("heading", { name: "OHLC verstanden" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "OHLC verstanden" }),
  ).toBeVisible();
  await navigate("Übungsbereich");
  await page.getByPlaceholder("Wert eingeben").fill("4 / 11");
  await page
    .getByRole("button", { name: "Antwort prüfen", exact: true })
    .click();
  await expect(page.getByText("✓ Nachvollziehbar gelöst")).toBeVisible();
  await page.getByRole("button", { name: "Neue Aufgabe" }).click();
  await page.getByPlaceholder("Wert eingeben").fill("5 / 13");
  await page
    .getByRole("button", { name: "Antwort prüfen", exact: true })
    .click();
  await expect(page.getByText("✓ Nachvollziehbar gelöst")).toBeVisible();
  await page
    .locator(".exercise-picker")
    .getByRole("button", { name: "Geldrisiko berechnen" })
    .click();
  await page.getByPlaceholder("Wert eingeben").fill("30");
  await page
    .getByRole("button", { name: "Antwort prüfen", exact: true })
    .click();
  await expect(page.getByText("✓ Nachvollziehbar gelöst")).toBeVisible();
  await page
    .locator(".exercise-picker")
    .getByRole("button", { name: "Reaktionsbereiche zeichnen" })
    .click();
  await page.getByLabel("Untergrenze (Punkte)").fill("114");
  await page.getByLabel("Obergrenze (Punkte)").fill("116");
  await page
    .getByRole("button", { name: "Antwort prüfen", exact: true })
    .click();
  await expect(page.getByText("✓ Nachvollziehbar gelöst")).toBeVisible();
  await page
    .locator(".exercise-picker")
    .getByRole("button", { name: "Orderausführung" })
    .click();
  await page
    .getByRole("button", { name: "Kauf-Limit 99", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Antwort prüfen", exact: true })
    .click();
  await expect(page.getByText("✓ Nachvollziehbar gelöst")).toBeVisible();
  await page.getByLabel("Stop-Abstand (Punkte)", { exact: true }).fill("0");
  await expect(
    page.getByText(
      "Bitte gültige positive Werte eingeben; Kosten dürfen null sein.",
    ),
  ).toBeVisible();
  await page.getByLabel("Stop-Abstand (Punkte)", { exact: true }).fill("8");
  await expect(
    page.getByText("Geplant gesamt: 36.00 €", { exact: false }),
  ).toBeVisible();
  // Check every practice type, including independently identified chart swing highs.
  await navigate("Dashboard");
  await navigate("Übungsbereich");
  for (const [name, value] of [
    ["Positionsgröße berechnen", "3"],
    ["CRV & Nettoergebnis", "2 / 56"],
    ["Erwartungswert", "5"],
    ["Hebel & Margin", "5 / nein"],
  ]) {
    await page
      .locator(".exercise-picker")
      .getByRole("button", { name })
      .click();
    await page.getByPlaceholder("Wert eingeben").fill(value);
    await page
      .getByRole("button", { name: "Antwort prüfen", exact: true })
      .click();
    await expect(page.getByText("✓ Nachvollziehbar gelöst")).toBeVisible();
  }
  for (const [name, value] of [
    ["Marktphasen einordnen", "Aufwärtsphase"],
    ["Prozessregeln erkennen", "Regelverstoß trotz Gewinn"],
    ["Backtest überprüfen", "Look-ahead-Bias: Zukunftswissen"],
  ]) {
    await page
      .locator(".exercise-picker")
      .getByRole("button", { name })
      .click();
    await page.getByRole("button", { name: value, exact: true }).click();
    await page
      .getByRole("button", { name: "Antwort prüfen", exact: true })
      .click();
    await expect(page.getByText("✓ Nachvollziehbar gelöst")).toBeVisible();
  }
  await page
    .locator(".exercise-picker")
    .getByRole("button", { name: "Hochs & Tiefs markieren" })
    .click();
  for (const i of [4, 10, 16, 22, 28])
    await page
      .getByRole("button", { name: new RegExp(`^Kerze ${i}:`) })
      .click();
  await page
    .getByLabel("Letzter bestätigter Punkt im Vergleich")
    .selectOption("HH");
  await page
    .getByRole("button", { name: "Antwort prüfen", exact: true })
    .click();
  await expect(page.getByText("✓ Nachvollziehbar gelöst")).toBeVisible();
  await navigate("Tests");
  await page.getByRole("button", { name: "Zwischentest starten" }).click();
  await quiz(20, 16);
  await expect(
    page.getByRole("heading", { name: "Wissenstest bestanden" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Zur Übersicht", exact: true })
    .click();
  await page.getByRole("button", { name: "Abschlusstest starten" }).click();
  await quiz(30, 23);
  await expect(
    page.getByRole("heading", { name: "Hier kannst du weiterlernen" }),
  ).toBeVisible();
  await navigate("Einstellungen");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON exportieren" }).click();
  const download = await downloadEvent;
  const exported = await readFile(await download.path(), "utf8");
  assert.equal(JSON.parse(exported).profiles.Patrik.notes.length, 1);
  await page.locator("input[type=file]").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":99}'),
  });
  await expect(page.getByText(/Import abgelehnt:/)).toBeVisible();
  assert.equal((await state()).profiles.Patrik.notes.length, 1);
  page.once("dialog", (d) => d.dismiss());
  await page
    .getByRole("button", { name: "Fortschritt von Patrik löschen" })
    .click();
  assert.equal((await state()).profiles.Patrik.notes.length, 1);
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Fortschritt von Patrik löschen" })
    .click();
  await expect
    .poll(async () => (await state()).profiles.Patrik.notes.length)
    .toBe(0);
  page.once("dialog", (d) => d.accept());
  await page.locator("input[type=file]").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(exported),
  });
  await expect(
    page.getByText("Sicherung erfolgreich geprüft und importiert."),
  ).toBeVisible();
  await expect
    .poll(async () => (await state()).profiles.Patrik.notes.length)
    .toBe(1);
  assert.equal((await state()).profiles.Fabian.notes.length, 0);
  for (const [name, heading] of [
    ["14-Tage-Lernpfad", "Ein Fundament, das bleibt."],
    ["Regelbuch", "Dein Regelbuch"],
    ["Tradinglexikon", "Dein Tradinglexikon"],
  ]) {
    await navigate(name);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
  }
  await page
    .getByRole("textbox", { name: "Lexikon durchsuchen" })
    .fill("Slippage");
  await expect(page.locator(".glossary-grid h2")).toHaveText([
    "Liquidität",
    "Slippage",
  ]);
  await navigate("Dashboard");
  await page.getByRole("button", { name: "Lernsession starten" }).click();
  await expect(page.locator(".timer-digits")).not.toContainText("00:00");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page
    .getByRole("button", { name: "Session beenden & speichern" })
    .click();
  await expect
    .poll(async () => (await state()).profiles.Patrik.sessions.length)
    .toBe(1);
  // Mobile navigation, SVG pointer interaction and keyboard alternatives.
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mobile = await mobileContext.newPage();
  mobile.on("pageerror", (e) => errors.push(e.message));
  await mobile.goto(base);
  await expect(
    mobile.getByRole("heading", { name: /Schön, dass du da bist/ }),
  ).toBeVisible();
  await mobile.screenshot({ path: ".next/academy-mobile.png", fullPage: true });
  assert.equal(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await mobile.getByRole("button", { name: "Navigation öffnen" }).click();
  await mobile
    .getByRole("link", { name: "Übungsbereich", exact: true })
    .click();
  await expect(
    mobile.getByRole("heading", { name: "Dein Übungsbereich" }),
  ).toBeVisible();
  await mobile
    .locator(".exercise-picker")
    .getByRole("button", { name: "Hochs & Tiefs markieren" })
    .click();
  const candle = mobile.getByRole("button", { name: /^Kerze 4:/ });
  await candle.focus();
  await mobile.keyboard.press("Enter");
  await expect(candle).toHaveAttribute("aria-pressed", "true");
  await candle.tap();
  await expect(candle).toHaveAttribute("aria-pressed", "false");
  await mobile
    .locator(".exercise-picker")
    .getByRole("button", { name: "Reaktionsbereiche zeichnen" })
    .click();
  const svg = mobile.locator(".exercise-main .chart-scroll>svg");
  await svg.scrollIntoViewIfNeeded();
  const box = await svg.boundingBox();
  const touch = await mobileContext.newCDPSession(mobile);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: box.x + box.width * 0.2, y: box.y + box.height * 0.65 }],
  });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: box.x + box.width * 0.3, y: box.y + box.height * 0.75 }],
  });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  assert.notEqual(
    await mobile.getByLabel("Untergrenze (Punkte)").inputValue(),
    "98",
  );
  await mobile.getByLabel("Untergrenze (Punkte)").fill("99");
  await mobile.getByLabel("Obergrenze (Punkte)").fill("101");
  await mobile
    .getByRole("button", { name: "Antwort prüfen", exact: true })
    .click();
  await expect(mobile.getByText("✓ Nachvollziehbar gelöst")).toBeVisible();
  assert.equal(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await mobile.screenshot({
    path: ".next/academy-mobile-exercise.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: dashboard, lessons, terms, daily/mid/final tests, reviews, profile isolation, reload, notes, exercises, calculators, import/export, delete confirmation, timer, desktop/mobile navigation and charts.",
  );
} finally {
  await browser.close();
}
