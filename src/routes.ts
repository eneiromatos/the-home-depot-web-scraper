import {
  createPuppeteerRouter,
  RequestQueue,
  Dataset,
} from "@crawlee/puppeteer";
import { labels } from "./labels.js";
import { allPages, startPage, lastPage } from "./main.js";
import { getRequest } from "./requestGenerator.js";

export const router = createPuppeteerRouter();

const BaseURL = "https://www.homedepot.com/";

router.addHandler(labels.listing, async ({ request, page, log }) => {
  log.info("Handling:", { label: request.label, url: request.url });
  const requestQueue = await RequestQueue.open();

  async function reziseVieport() {
    const bodyWidth = 1440;
    const bodyHeight = 50000;
    await page.setViewport({ width: bodyWidth, height: bodyHeight });
    for (let index = 1; index <= 6; index++) {
      const selector = "section[id*=browse-search-pods-${num}]";
      await page.keyboard.press("PageDown");
      await page.keyboard.press("PageDown");
      try {
        await page.waitForSelector(selector, { visible: true });
      } catch (error) {
        break;
      }
    }
  }

  async function getPaginationData() {
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
    return { numItems, totalItems };
  }

  async function getItems() {
    const selector =
      'div.results-wrapped div[data-lg-name*="Product Pod"] div.product-pod__title a';

    const itemRelUrls = await page.$$eval(selector, (urls) =>
      urls.map((url) => url.getAttribute("href"))
    );
    const itemUrls = itemRelUrls.map((relUrl) =>
      new URL(relUrl, BaseURL).toString()
    );
    return itemUrls;
  }

  async function getPagination() {
    const paginationData = await getPaginationData();
    const maxPages = Math.ceil(
      paginationData.totalItems / paginationData.numItems
    );
    const totalPages = generatePages(1, maxPages, paginationData.numItems);
    return totalPages;
  }

  function generatePages(
    minPage: number,
    maxPage: number,
    itemsPerPage: number
  ) {
    let newUrl = new URL(request.url);
    let paginationUrls: string[] = [];
    const paginationParam = "Nao";
    for (let index = minPage - 1; index <= maxPage - 1; index++) {
      const itemNum = index * itemsPerPage;
      newUrl.searchParams.set(paginationParam, itemNum.toString());
      paginationUrls.push(newUrl.toString());
    }
    return paginationUrls;
  }

  async function navigateItemsUrls() {
    const itemsUrls = await getItems();
    for (const url of itemsUrls) {
      const request = getRequest(url);
      await requestQueue.addRequest(request);
    }
  }

  async function navigateAllPaginationUrls() {
    const paginationUrls = await getPagination();
    for (const url of paginationUrls) {
      const request = getRequest(url);
      await requestQueue.addRequest(request);
    }
  }

  async function navigateRangePaginationUrls(minPage: number, maxPage: number) {
    const paginationData = await getPaginationData();
    const paginationUrls = generatePages(
      minPage,
      maxPage,
      paginationData.numItems
    );
    for (const url of paginationUrls) {
      const request = getRequest(url);
      await requestQueue.addRequest(request);
    }
  }

  /*************************************************************************/
  await reziseVieport();
  const isPagination = request.url.includes("Nao=");
  const isSinglePage = startPage === lastPage;
  const isRange = startPage != lastPage;

  switch (true) {
    case isPagination:
      await navigateItemsUrls();
      break;
    case allPages && !isPagination:
      await navigateAllPaginationUrls();
      break;
    case (isSinglePage || isRange) && !isPagination:
      await navigateRangePaginationUrls(startPage, lastPage);
      break;
    default:
      break;
  }
});

router.addHandler(labels.detail, async ({ request, page, log }) => {
  log.info("Handling:", { label: request.label, url: request.url });

  async function getTitle() {
    const selector = "span.product-title h1";
    await page.waitForSelector(selector, { visible: true });
    const title = await page.$eval(selector, (el) => el.textContent.trim());
    return title;
  }

  async function getBrand() {
    const selector = "span.product-details__brand--link";
    try {
      await page.waitForSelector(selector, { visible: true });
    } catch (error) {
      return "";
    }
    const brand = await page.$eval(selector, (el) => el.textContent.trim());
    return brand;
  }

  async function getCodes() {
    const codes = page.$$eval(
      "h2[class*='product-info-bar__detail']",
      (codes) =>
        codes.map((code) => {
          const codeObj: Object = {};
          const codeStr = code.textContent;
          const codeName = codeStr.split("#")[0].trim();
          const codeNum = codeStr.split("#")[1].trim();
          codeObj[codeName] = codeNum;
          return codeObj;
        })
    );
    return codes;
  }

  async function getDescription() {
    const selector =
      'div[class="grid desktop-content-wrapper__main-description"]';
    try {
      await page.waitForSelector(selector);
    } catch (error) {
      return "";
    }
    const description = await page.$eval(selector, (table) =>
      table.innerHTML.trim()
    );
    return description;
  }

  async function getImages() {
    const mainImageSelector = "div.mediagallery__mainimage";
    const thumbsSelector = "div.overlay__thumbnails img";
    try {
      await page.waitForSelector(mainImageSelector);
    } catch (error) {
      return [];
    }
    await page.click(mainImageSelector);
    try {
      await page.waitForSelector(thumbsSelector);
    } catch (error) {
      return [];
    }
    const imageRelUrls = await page.$$eval(thumbsSelector, (images) =>
      images.map((image) => image.getAttribute("src").replace("_145", "_1000"))
    );
    const imageUrls = imageRelUrls.map((image) =>
      new URL(image, BaseURL).toString()
    );
    return imageUrls;
  }
  /**************************************************************************************/
  const url = request.url;
  const title = await getTitle();
  const brand = await getBrand();
  const codes = await getCodes();
  const description = await getDescription();
  const images = await getImages();

  await Dataset.pushData({
    url,
    title,
    brand,
    codes,
    description,
    images,
  });
});
