import { createPuppeteerRouter } from "@crawlee/puppeteer";
import { labels } from "./labels.js";
import { allPages, startPage, lastPage } from "./main.js";

export const router = createPuppeteerRouter();

router.addHandler(labels.listing, async ({ request, page, log }) => {
  async function reziseVieport() {
    const bodyWidth = 1440;
    const bodyHeight = 40000;
    await page.setViewport({ width: bodyWidth, height: bodyHeight });
    await page.keyboard.press("End");
    await page.waitForSelector("#footerTagline");
  }

  async function getItems() {
    const selector =
      'div.results-wrapped div[data-lg-name*="Product Pod"] div.product-pod__title a';

    const itemUrls = await page.$$eval(selector, (urls) =>
      urls.map((url) => url.getAttribute("href"))
    );
    return itemUrls;
  }

  async function getPagination() {
    const numItemsRange = await page.$eval(
      "div.results-pagination__counts span:nth-of-type(1)",
      (el) => el.textContent
    );
    const totalItems = Number(
      await page.$eval(
        "div.results-pagination__counts span:nth-of-type(2)",
        (el) => el.textContent
      )
    );
    const numItems = Number(numItemsRange?.split("-")[1]);
    const maxPages = Math.ceil(totalItems / numItems);
    0 == 0;
  }
  await reziseVieport();
  await getPagination();
});

router.addHandler(labels.detail, async ({ request, page, log }) => {
  const title = await page.title();
  log.info(`Handle details: ${title} [${request.loadedUrl}]`);
});
