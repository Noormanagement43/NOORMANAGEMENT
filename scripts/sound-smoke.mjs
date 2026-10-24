import { chromium } from "playwright";

const siteUrl = process.env.SITE_URL;
if (!siteUrl) throw new Error("SITE_URL is required");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const consoleErrors = [];
const httpErrors = [];
page.on("response", response => {
  if (response.status() >= 400) httpErrors.push({ status: response.status(), url: response.url() });
});
page.on("console", message => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", error => consoleErrors.push(error.message));

try {
  const response = await page.goto(siteUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  if (!response || !response.ok()) throw new Error(`Live page HTTP status: ${response?.status() ?? "no response"}`);

  await page.waitForSelector("#noorSoundQuickControl", { state: "visible", timeout: 20000 });
  // Verify the Command Centre assets are part of the deployed public artifact too.
  const ccAssetResponses = await Promise.all([
    page.request.get(new URL("command-centre.js", siteUrl).toString()),
    page.request.get(new URL("command-centre.css", siteUrl).toString())
  ]);
  for (const assetResponse of ccAssetResponses) {
    if (!assetResponse.ok()) throw new Error(`Command Centre asset failed to load: ${assetResponse.status()} ${assetResponse.url()}`);
  }
  await page.waitForFunction(() => !!window.NOOR_SOUND?.playSound, { timeout: 20000 });

  // Exercise the current compact Sound ON/OFF control; the old test-only button was removed from the live UI.
  const quickToggle = page.locator("#noorSoundQuickToggle");
  await quickToggle.waitFor({ state: "visible", timeout: 10000 });
  await quickToggle.click();
  await page.waitForFunction(() => window.NOOR_SOUND?.getPreferences?.().masterSound === false, { timeout: 10000 });
  if ((await quickToggle.textContent()).trim() !== "Sound OFF") throw new Error("Quick sound control did not show Sound OFF");
  await quickToggle.click();
  await page.waitForFunction(() => window.NOOR_SOUND?.getPreferences?.().masterSound === true, { timeout: 10000 });
  if ((await quickToggle.textContent()).trim() !== "Sound ON") throw new Error("Quick sound control did not restore Sound ON");
  await page.waitForFunction(() => {
    const statuses = window.NOOR_SOUND?.getAssetStatuses?.();
    return statuses && Object.keys(statuses).length > 0 &&
      Object.values(statuses).every(item => item.state === "loaded");
  }, { timeout: 30000 });

  // Test the actual Sound & Feel settings UI using an isolated mount point.
  // This does not sign in, send messages or write school data.
  const settingsDiagnostics = await page.evaluate(() => {
    const api = window.NOOR_SOUND;
    const settings = window.NOOR_SOUND_SETTINGS;
    if (!api || !settings?.mount) throw new Error("Sound & Feel settings UI did not load");
    const before = api.getPreferences();
    const fixture = document.createElement("div");
    fixture.id = "noor-sound-settings-smoke-fixture";
    document.body.appendChild(fixture);
    settings.mount(fixture);
    const master = fixture.querySelector("#soundMasterToggle");
    const volume = fixture.querySelector("#soundVolumeSlider");
    const volumeLabel = fixture.querySelector("#soundVolumeValue");
    const voice = fixture.querySelector("#soundVoiceToggle");
    const haptic = fixture.querySelector("#soundHapticToggle");
    const previews = [...fixture.querySelectorAll("[data-sound-preview]")];

    master.checked = false;
    master.dispatchEvent(new Event("change", { bubbles: true }));
    const muteWorks = api.getPreferences().masterSound === false;

    // Exercise normal category preview handlers while master audio is OFF,
    // so the smoke test never creates unexpected loud audio.
    for (const button of previews) {
      if (!["voice", "haptic", "haptics"].includes(button.dataset.soundPreview)) button.click();
    }
    volume.value = "0.25";
    volume.dispatchEvent(new Event("input", { bubbles: true }));
    const volumeWorks = Math.abs(api.getPreferences().volume - 0.25) < 0.001 && volumeLabel.textContent === "25%";

    const previousVoice = Boolean(before.voiceCheers);
    voice.checked = !previousVoice;
    voice.dispatchEvent(new Event("change", { bubbles: true }));
    const voiceToggleWorks = Boolean(api.getPreferences().voiceCheers) === !previousVoice;

    const previousHaptic = Boolean(before.haptics);
    haptic.checked = !previousHaptic;
    haptic.dispatchEvent(new Event("change", { bubbles: true }));
    const hapticToggleWorks = Boolean(api.getPreferences().haptics) === !previousHaptic;

    api.setPreferences({
      masterSound: before.masterSound,
      voiceCheers: before.voiceCheers,
      haptics: before.haptics
    });
    api.setVolume(before.volume);
    const result = {
      previewButtonCount: previews.length,
      masterMuteToggleWorks: muteWorks,
      volumeSliderWorks: volumeWorks,
      voiceCheersToggleWorks: voiceToggleWorks,
      hapticToggleWorks: hapticToggleWorks
    };
    fixture.remove();
    return result;
  });
  if (settingsDiagnostics.previewButtonCount < 5) {
    throw new Error("Sound & Feel categories did not render enough preview controls: " + settingsDiagnostics.previewButtonCount);
  }
  if (!settingsDiagnostics.masterMuteToggleWorks || !settingsDiagnostics.volumeSliderWorks ||
      !settingsDiagnostics.voiceCheersToggleWorks || !settingsDiagnostics.hapticToggleWorks) {
    throw new Error("Sound & Feel control check failed: " + JSON.stringify(settingsDiagnostics));
  }

  const diagnostics = await page.evaluate(() => {
    const api = window.NOOR_SOUND;
    const statuses = api.getAssetStatuses();
    const names = api.getMappedSoundNames();
    const results = names.map(name => ({ name, resolves: api.playSound(name, { force: true, noVoice: true }) }));
    const failedAssets = Object.entries(statuses)
      .filter(([, item]) => item.state !== "loaded")
      .map(([key, item]) => ({ key, ...item }));
    return {
      title: document.title,
      buttonVisible: !!document.querySelector("#noorSoundQuickControl") &&
        getComputedStyle(document.querySelector("#noorSoundQuickControl")).display !== "none",
      mappedSoundCount: names.length,
      assetCount: Object.keys(statuses).length,
      failedAssets,
      failedNames: results.filter(item => !item.resolves).map(item => item.name),
      soundMap: names
    };
  });

  if (!diagnostics.buttonVisible) throw new Error("Sound quick-control is not visible on the deployed page");
  if (diagnostics.mappedSoundCount !== 40) throw new Error(`Expected 40 mapped sounds, got ${diagnostics.mappedSoundCount}`);
  if (diagnostics.failedAssets.length) throw new Error(`Audio assets not loaded: ${JSON.stringify(diagnostics.failedAssets)}`);
  if (diagnostics.failedNames.length) throw new Error(`playSound failed for: ${diagnostics.failedNames.join(", ")}`);

  const muteResult = await page.evaluate(() => {
    const api = window.NOOR_SOUND;
    api.setPreferences({ masterSound: false });
    return {
      preference: api.getPreferences().masterSound,
      soundPlayed: api.playSound("ding", { noVoice: true })
    };
  });
  if (muteResult.preference !== false || muteResult.soundPlayed !== false) {
    throw new Error("Mute check failed");
  }

  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => !!window.NOOR_SOUND?.getPreferences, { timeout: 20000 });
  const persisted = await page.evaluate(() => window.NOOR_SOUND.getPreferences().masterSound);
  if (persisted !== false) throw new Error("Sound preference did not persist after refresh");

  // Restore default ON in this test context before final checks.
  await page.evaluate(() => window.NOOR_SOUND.setPreferences({ masterSound: true }));
  if (httpErrors.length) throw new Error(`HTTP resource errors: ${JSON.stringify(httpErrors)}`);
  if (consoleErrors.length) throw new Error(`Browser console errors: ${consoleErrors.join(" | ")}`);

  console.log(JSON.stringify({
    result: "PASS",
    liveUrl: siteUrl,
    title: diagnostics.title,
    buttonVisible: diagnostics.buttonVisible,
    mappedSoundCount: diagnostics.mappedSoundCount,
    audioAssetsLoaded: diagnostics.assetCount,
    everyMappedSoundResolves: true,
    soundSettings: settingsDiagnostics,
    muteWorks: true,
    preferencePersistsAfterRefresh: true,
    consoleErrors: consoleErrors.length
  }, null, 2));
} finally {
  await browser.close();
}
