import { chromium } from "playwright";

const siteUrl = process.env.SITE_URL;
if (!siteUrl) throw new Error("SITE_URL is required");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const resourceErrors = [];
page.on("response", response => {
  if (response.status() >= 400) resourceErrors.push({ status: response.status(), url: response.url() });
});
page.on("pageerror", error => resourceErrors.push({ type: "pageerror", message: error.message }));

try {
  const response = await page.goto(siteUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  if (!response || !response.ok()) throw new Error(`Live page HTTP status: ${response?.status() ?? "no response"}`);

  const [css, js] = await Promise.all([
    page.request.get(new URL("theme-system.css", siteUrl).toString()),
    page.request.get(new URL("theme-system.js", siteUrl).toString())
  ]);
  if (!css.ok()) throw new Error(`Theme stylesheet unavailable: HTTP ${css.status()}`);
  if (!js.ok()) throw new Error(`Theme module unavailable: HTTP ${js.status()}`);
  await page.waitForFunction(() => !!window.NOOR_THEME_SETTINGS?.mount, { timeout: 15000 });

  const diagnostics = await page.evaluate(() => {
    const fixture = document.createElement("div");
    fixture.id = "noor-appearance-smoke-fixture";
    document.body.appendChild(fixture);
    window.NOOR_THEME_SETTINGS.mount(fixture);

    const cards = [...fixture.querySelectorAll("[data-theme-choice]")];
    const outcomes = [];
    for (const card of cards) {
      card.click();
      const theme = card.dataset.themeChoice;
      const rootTheme = document.documentElement.dataset.noorTheme;
      const primary = getComputedStyle(document.documentElement).getPropertyValue("--berry").trim();
      const selected = card.getAttribute("aria-pressed") === "true";
      outcomes.push({ theme, rootTheme, primary, selected });
    }

    const font = fixture.querySelector("#noorFontScale");
    font.value = "large";
    font.dispatchEvent(new Event("change", { bubbles: true }));
    const reduced = fixture.querySelector("#noorReducedMotion");
    reduced.checked = true;
    reduced.dispatchEvent(new Event("change", { bubbles: true }));

    const result = {
      pageTitle: document.title,
      themeCount: cards.length,
      outcomes,
      largeFontApplied: document.documentElement.dataset.noorFont === "large",
      reducedMotionApplied: document.documentElement.classList.contains("noor-reduced-motion"),
      styleLoaded: Boolean(getComputedStyle(fixture.querySelector(".noor-theme-panel")).borderRadius)
    };
    fixture.remove();
    localStorage.removeItem("noor.appearance.undefined");
    return result;
  });

  if (diagnostics.themeCount !== 8) throw new Error(`Expected 8 theme options, got ${diagnostics.themeCount}`);
  const broken = diagnostics.outcomes.filter(x => x.rootTheme !== x.theme || !x.primary || !x.selected);
  if (broken.length) throw new Error(`Theme apply/selection failed: ${JSON.stringify(broken)}`);
  const uniquePrimaries = new Set(diagnostics.outcomes.map(x => x.primary));
  if (uniquePrimaries.size !== 8) throw new Error("Themes do not resolve to eight distinct primary palettes.");
  if (!diagnostics.largeFontApplied || !diagnostics.reducedMotionApplied) {
    throw new Error("Font-size or reduced-motion settings did not apply.");
  }
  if (resourceErrors.length) throw new Error(`Page resource/runtime errors: ${JSON.stringify(resourceErrors)}`);

  console.log(JSON.stringify({
    result: "PASS",
    siteUrl,
    title: diagnostics.pageTitle,
    themeCount: diagnostics.themeCount,
    themeKeys: diagnostics.outcomes.map(x => x.theme),
    distinctPalettes: uniquePrimaries.size,
    fontScale: "large",
    reducedMotion: true,
    resourceErrors
  }, null, 2));
} finally {
  await browser.close();
}
