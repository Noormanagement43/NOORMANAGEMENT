import { chromium } from "playwright";

const siteUrl = process.env.SITE_URL;
if (!siteUrl) throw new Error("SITE_URL is required");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageErrors = [];
const resourceErrors = [];
page.on("pageerror", error => pageErrors.push(error.message));
page.on("response", response => {
  if (response.status() >= 400) resourceErrors.push({ status: response.status(), url: response.url() });
});

try {
  const response = await page.goto(siteUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  if (!response || !response.ok()) throw new Error(`Application shell HTTP status: ${response?.status() ?? "no response"}`);
  await page.waitForSelector("#loginForm", { state: "attached", timeout: 15000 });

  const checks = [];
  const visible = id => page.locator("#" + id).evaluate(el => !el.classList.contains("hidden"));
  const record = async (name, condition) => {
    checks.push({ name, passed: Boolean(condition) });
    if (!condition) throw new Error("Application shell test failed: " + name);
  };

  await page.locator("#loginTab").click();
  await record("Login tab opens login form and portal selector", await visible("loginForm") && await visible("portalPickerWrap"));

  await page.locator("#registerTab").click();
  await record("Student registration tab switches view and hides portal selector", await visible("registerForm") && !(await visible("loginForm")) && !(await visible("portalPickerWrap")));

  await page.locator("#ownerTab").click();
  await record("School-owner registration tab switches view", await visible("ownerRegisterForm") && !(await visible("portalPickerWrap")));

  await page.locator("#joinTab").click();
  await record("Staff invitation join tab switches view", await visible("staffJoinForm") && !(await visible("portalPickerWrap")));

  await page.locator("#loginTab").click();
  for (const portal of ["student", "teacher", "management", "creator"]) {
    await page.locator('[data-portal="' + portal + '"]').click();
    const selected = await page.locator('[data-portal="' + portal + '"]').getAttribute("aria-pressed");
    await record("Portal selection: " + portal, selected === "true");
    if (portal === "management") {
      await record("Management selection reveals leadership-role picker", await visible("leadershipPicker"));
      for (const role of ["principal", "owner", "manager"]) {
        await page.locator('[data-leadership-role="' + role + '"]').click();
        await record("Leadership selection: " + role, await page.locator('[data-leadership-role="' + role + '"]').getAttribute("aria-pressed") === "true");
      }
    }
  }

  const password = page.locator("#loginPassword");
  await password.fill("NotARealPassword123");
  await page.locator("#toggleLoginPassword").click();
  await record("Show password control", await password.getAttribute("type") === "text");
  await page.locator("#toggleLoginPassword").click();
  await record("Hide password control", await password.getAttribute("type") === "password");

  // With no email entered, these paths must show validation and must not send a request.
  await page.locator("#loginEmail").fill("");
  await page.locator("#forgotBtn").click();
  const forgotText = await page.locator("#authMessage").innerText();
  await record("Forgot-password requires an email before requesting a reset", /email/i.test(forgotText) && /enter/i.test(forgotText));

  await page.locator("#resendConfirmBtn").click();
  const resendText = await page.locator("#authMessage").innerText();
  await record("Resend-verification requires an email before requesting delivery", /email/i.test(resendText) && /enter/i.test(resendText));

  if (pageErrors.length) throw new Error("Browser JavaScript errors: " + pageErrors.join(" | "));
  if (resourceErrors.length) throw new Error("HTTP asset errors: " + JSON.stringify(resourceErrors));

  console.log(JSON.stringify({
    result: "PASS",
    siteUrl,
    checksPassed: checks.filter(x => x.passed).length,
    checksTotal: checks.length,
    checks,
    pageErrors,
    resourceErrors,
    note: "Public authentication-shell interactions only. No account creation, login, password reset delivery, school data mutation, or authenticated dashboard testing was performed."
  }, null, 2));
} finally {
  await browser.close();
}
