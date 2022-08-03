import { createPuppeteerRouter } from "@crawlee/puppeteer";
import { labels } from "./labels.js";
import { allPages, startPage, lastPage } from "./main.js";

export const router = createPuppeteerRouter();

router.addHandler(labels.listing, async ({ request, page, log }) => {
  const title = await page.title();
  log.info(`Handle pagination: ${title} [${request.loadedUrl}]`);
});

router.addHandler(labels.detail, async ({ request, page, log }) => {
  const title = await page.title();
  log.info(`Handle details: ${title} [${request.loadedUrl}]`);
});
