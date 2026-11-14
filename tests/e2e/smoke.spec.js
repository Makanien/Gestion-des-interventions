import { test, expect } from "@playwright/test";

// Tests « fumée » : l'application démarre, installe son service worker et reste
// utilisable hors ligne. Ils n'exigent aucun compte Supabase.

test("l'application démarre sans erreur JavaScript non gérée", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("#app")).not.toBeEmpty();
  expect(errors).toEqual([]);
});

test("le zoom n'est pas bloqué (BP-05)", async ({ page }) => {
  await page.goto("/");
  const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
  expect(viewport).not.toMatch(/maximum-scale|user-scalable\s*=\s*no/);
});

test("le service worker s'active et met l'application en cache", async ({ page }) => {
  await page.goto("/");
  const cached = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    await new Promise((r) =>
      reg.active?.state === "activated" ? r() : reg.active?.addEventListener("statechange", () => reg.active.state === "activated" && r()),
    );
    const names = await caches.keys();
    const urls = [];
    for (const n of names) for (const req of await (await caches.open(n)).keys()) urls.push(new URL(req.url).pathname);
    return urls;
  });
  expect(cached).toEqual(expect.arrayContaining(["/app.js", "/utils.js", "/errorlog.js", "/idb.js"]));
});

test("rechargement HORS LIGNE : l'application reste disponible", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // 2e chargement : la page est désormais contrôlée par le service worker
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#app")).not.toBeEmpty();
});
