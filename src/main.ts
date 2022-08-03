import { Actor } from "apify";
import { PuppeteerCrawler, log } from "@crawlee/puppeteer";
import { router } from "./routes.js";
import { labels } from "./labels.js";

await Actor.init();

interface InputSchema {
  startUrls: string[];
  debug?: boolean;
}

const { startUrls = ["https://apify.com"], debug } =
  (await Actor.getInput<InputSchema>()) ?? {};

if (debug) {
  log.setLevel(log.LEVELS.DEBUG);
}

const proxyConfiguration = await Actor.createProxyConfiguration();

const crawler = new PuppeteerCrawler({
  proxyConfiguration,
  // Be nice to the websites.
  // Remove to unleash full power.
  maxConcurrency: 50,
  requestHandler: router,
});

await crawler.addRequests(startUrls);

log.info("Starting the crawl.");
await crawler.run();
log.info("Crawl finished.");

await Actor.exit();
