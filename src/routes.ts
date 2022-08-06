import {
  createPuppeteerRouter,
  RequestQueue,
  Dataset,
} from "@crawlee/puppeteer";
import { product } from "./main.js";
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
  const productData = await product;

  async function getTitle() {
    const title = productData.data.identifiers.productLabel;
    return title;
  }

  async function getBrand() {
    const brand = productData.data.identifiers.brandName;
    return brand;
  }

  async function getCodes() {
    const id = productData.data.identifiers.itemId;
    const sku = productData.data.identifiers.storeSkuNumber;
    const modelNumber = productData.data.identifiers.modelNumber;
    const upc = productData.data.identifiers.upc;
    const codes = {
      id: id ? id : null,
      sku: sku ? sku : null,
      modelNumber: modelNumber ? modelNumber : null,
      upc: upc ? upc : null,
    };
    return codes;
  }

  async function getDescriptionHTML() {
    const abstract = productData.data.details.description;
    const bulletPoints = productData.data.details.descriptiveAttributes
      .filter((el) => !el.value.includes("href"))
      .map((el) => el.value);
    let descriptionHTML = "";
    descriptionHTML = descriptionHTML.concat(`<p>${abstract}</p>`, "<ul>");
    for (let index = 0; index < bulletPoints.length; index++) {
      descriptionHTML = descriptionHTML.concat(
        `<li>${bulletPoints[index]}</li>`
      );
      if (index === bulletPoints.length - 1) {
        descriptionHTML = descriptionHTML.concat("</ul>");
      }
    }
    return { abstract, bulletPoints, descriptionHTML };
  }

  async function getMedia() {}
  /**************************************************************************************/
  const url = request.url;
  const title = await getTitle();
  const brand = await getBrand();
  const codes = await getCodes();
  const descriptionHTML = await getDescriptionHTML();
  const media = await getImages();

  await Dataset.pushData({
    url,
    title,
    brand,
    codes,
    descriptionHTML,
    media,
    product,
  });
});
