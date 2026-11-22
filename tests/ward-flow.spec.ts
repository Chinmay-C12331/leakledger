import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { resolve } from "node:path";

test("mobile submission, officer comparison, shared repair and public dashboard", async ({
  page,
  browser,
  baseURL,
}, info) => {
  const exceptions: string[] = [];
  page.on("pageerror", (e) => exceptions.push(e.message));
  await page.goto("/");
  await page.getByLabel("Officer password").fill("browser-test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ward overview" }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Review queue/ })
    .click();
  const phone = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const resident = await phone.newPage();
  resident.on("pageerror", (e) => exceptions.push(e.message));
  await resident.goto("/report");
  await resident.getByLabel("Report language").selectOption("hi");
  await resident
    .getByLabel("Description")
    .fill("स्कूल के नीले गेट के पास पाइप के जोड़ से पानी निकल रहा है।");
  await resident.getByLabel("Demo landmark").selectOption("school");
  await resident
    .getByLabel("Photo", { exact: true })
    .setInputFiles(resolve("demo/resident-school-gate.jpg"));
  await resident.getByRole("button", { name: "Submit report" }).click();
  await expect(
    resident.getByRole("heading", { name: "Report received" }),
  ).toBeVisible();
  await resident.reload();
  await resident.getByRole("link", { name: "Track this report" }).click();
  await expect(
    resident.getByText("Awaiting review", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Refresh reports" }).click();
  await page
    .getByRole("row")
    .filter({ hasText: "LL-1044" })
    .getByRole("button")
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Likely same", { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Agreement" }),
  ).toBeVisible();
  await expect(dialog.locator("img")).toHaveCount(2);
  await expect
    .poll(() =>
      dialog
        .locator("img")
        .evaluateAll((nodes) =>
          nodes.every((n) => (n as HTMLImageElement).naturalWidth > 0),
        ),
    )
    .toBe(true);
  await page.screenshot({ path: info.outputPath("officer-comparison.png") });
  await dialog.getByRole("button", { name: "Confirm link" }).click();
  await dialog.getByLabel("Repair status").selectOption("repaired");
  const note = "The school-gate pipe joint has been replaced.";
  await dialog.getByLabel("Public repair note").fill(note);
  await dialog.getByRole("button", { name: "Save repair update" }).click();
  await expect(
    dialog.getByText("Repair update saved for all linked reports."),
  ).toBeVisible();
  await resident.reload();
  const repaired = async (p: Page) => {
    await expect(p.getByText("Repaired", { exact: true })).toBeVisible();
    await expect(p.getByText(note)).toBeVisible();
  };
  await repaired(resident);
  const second = await phone.newPage();
  const sibling = await dialog
    .getByRole("link", { name: "Track LL-1042" })
    .getAttribute("href");
  await second.goto(sibling!);
  await repaired(second);
  await dialog.getByRole("button", { name: "Close report review" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Overview" })
    .click();
  await expect(
    page.getByRole("row").filter({ hasText: "LL-1041" }),
  ).toContainText("Assigned");
  await second.goto("/dashboard");
  await expect(
    second.getByRole("heading", { name: "Public dashboard" }),
  ).toBeVisible();
  await expect(second.getByText(note)).toBeVisible();
  await expect(second.locator(".leaflet-container")).toBeVisible();
  await expect(second.getByText("LL-1044")).toHaveCount(0);
  expect((await phone.request.get("/api/officer/queue")).status()).toBe(401);
  expect(exceptions).toEqual([]);
  await phone.close();
});
