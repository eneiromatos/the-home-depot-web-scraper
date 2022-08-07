import { Actor } from "apify";
import {
  PuppeteerCrawler,
  log,
  RequestQueue,
  Configuration,
  puppeteerUtils,
} from "@crawlee/puppeteer";
import { router } from "./routes.js";
import { getRequest } from "./requestGenerator.js";
await Actor.init();

interface InputSchema {
  categoryUrls: Array<string>;
  keywords: Array<string>;
  productUrls: Array<string>;
  startPage: number;
  lastPage: number;
  allPages: boolean;
  minPrice: number;
  maxPrice: number;
}

const {
  categoryUrls = [],
  keywords = [],
  productUrls = [],
  startPage = 1,
  lastPage = 1,
  allPages = false,
  minPrice = 0,
  maxPrice = 0,
} = (await Actor.getInput<InputSchema>()) ?? {};

const proxyConfiguration = await Actor.createProxyConfiguration();
const requestQueue = await RequestQueue.open();

export { allPages, lastPage, startPage };
export let productData: any = { data: {}, variations: {} };

// Add the category requests to the request queue.
for (const url of categoryUrls) {
  await requestQueue.addRequest(getRequest(url, minPrice, maxPrice));
}

// Add the product requests to the request queue.
for (const url of productUrls) {
  await requestQueue.addRequest(getRequest(url, minPrice, maxPrice));
}

// Add the keyword requests to the request queue.
for (let keyword of keywords) {
  const url = `https://www.homedepot.com/s/${keyword}`;
  await requestQueue.addRequest(getRequest(url, minPrice, maxPrice));
}

const config = new Configuration({ headless: true });

const crawler = new PuppeteerCrawler(
  {
    proxyConfiguration,
    requestQueue,
    maxRequestRetries: 5,
    minConcurrency: 5,
    maxConcurrency: 20,
    requestHandler: router,
    preNavigationHooks: [
      async (crawlingContext, gotoOptions) => {
        const { page } = crawlingContext;
        gotoOptions.waitUntil = "networkidle2";
        await puppeteerUtils.blockRequests(page, {
          urlPatterns: [".webp", ".svg", ".png", ".woff2"],
        });
        page.on("response", async (response) => {
          if (
            response.url().includes("productClientOnlyProduct") &&
            response.status() === 200
          ) {
            const rawData = await response.buffer();
            const jsonData = await JSON.parse(rawData.toString());
            productData.data = jsonData.data.product;
          }
          if (
            response.url().includes("mediaPriceInventory") &&
            response.status() === 200
          ) {
            const rawData = await response.buffer();
            const jsonData = await JSON.parse(rawData.toString());
            productData.variations = jsonData.data.product;
          }
        });
      },
    ],
  },
  config
);

log.info("Starting the crawl.");
await crawler.run();
log.info("Crawl finished.");

await Actor.exit();
