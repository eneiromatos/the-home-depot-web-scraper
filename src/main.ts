import { Actor } from "apify";
import {
  PuppeteerCrawler,
  log,
  RequestQueue,
  //Configuration,
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

export { allPages, lastPage, startPage };

const proxyConfiguration = await Actor.createProxyConfiguration({
  countryCode: "US",
});
const requestQueue = await RequestQueue.open();

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

//const config = new Configuration({ headless: true });

const crawler = new PuppeteerCrawler(
  {
    proxyConfiguration,
    requestQueue,
    maxRequestRetries: 5,
    minConcurrency: 1,
    maxConcurrency: 10,
    preNavigationHooks: [
      async ({ page, request }, gotoOptions) => {
        gotoOptions.waitUntil = "networkidle2";
        await puppeteerUtils.blockRequests(page, {
          urlPatterns: [".webp", ".svg", ".png", ".woff2"],
        });
        page.on("response", async (response) => {
          const responseFromURL = response.request().headers().referer;
          const requesterURL = request.url;
          if (
            response.url().includes("productClientOnlyProduct") &&
            response.status() === 200 &&
            responseFromURL === requesterURL
          ) {
            const rawData = await response.buffer();
            const jsonData = await JSON.parse(rawData.toString());
            request.userData.data = jsonData.data.product;
          }
          if (
            response.url().includes("opname=metadata") &&
            response.status() === 200 &&
            responseFromURL === requesterURL
          ) {
            const rawData = await response.buffer();
            const jsonData = await JSON.parse(rawData.toString());
            request.userData.variations = jsonData.data.metadata;
          }
          if (
            response.url().includes("searchModel") &&
            response.status() === 200 &&
            responseFromURL === requesterURL
          ) {
            const rawData = await response.buffer();
            const jsonData = await JSON.parse(rawData.toString());
            request.userData.searhResults = jsonData.data.searchModel;
          }
        });
      },
    ],
    requestHandler: router,
  }
  //config
);

log.info("Starting the crawl.");
await crawler.run();
log.info("Crawl finished.");

await Actor.exit();
