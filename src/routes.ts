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

router.addHandler(labels.listing, async ({ request, log }) => {
  log.info("Handling:", { label: request.label, url: request.url });
  const requestQueue = await RequestQueue.open();

  const searhResults = request.userData.searhResults;

  async function getPaginationData() {
    const totalItems = searhResults.searchReport.totalProducts;
    const numItems = searhResults.searchReport.pageSize;
    return { numItems, totalItems };
  }

  async function getItems() {
    const itemUrls = searhResults.products.map((el) =>
      new URL(el.identifiers.canonicalUrl, BaseURL).toString()
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

  const productData = {
    data: request.userData.data,
    variations: request.userData.variations,
  };

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

  async function getDescription() {
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
    return { descriptionHTML, abstract, bulletPoints };
  }

  async function getImages() {
    const images = productData.data.media.images.map((el) => {
      const maxRes = el.sizes.at(-1);
      const imgURL = el.url.replace("<SIZE>", maxRes);
      return imgURL;
    });
    return images;
  }

  async function getAvailability() {
    let isAvailable = productData.data.pricing.value ? true : false;
    let sellsInStore = false;
    let sellsOnline = false;

    let availableAt = productData.data.availabilityType.type;

    if (availableAt === "Shared") {
      sellsInStore = true;
      sellsOnline = true;
    } else if (availableAt === "Online") {
      sellsInStore = false;
      sellsOnline = true;
    } else if (availableAt === "Store Only") {
      sellsInStore = true;
      sellsOnline = false;
    }

    const availabilityOptions = {
      isAvailable,
      sellsInStore,
      sellsOnline,
    };

    return availabilityOptions;
  }

  async function getPricing() {
    let princig = {
      currencySymbol: "$",
      currentPrice: 0,
      currentPriceUnit: null,
      promoData: { originalPrice: 0, dates: { start: null, end: null } },
      alternatePriceData: { alternatePrice: 0, alternatePriceUnit: null },
    };

    const availability = await getAvailability();

    if (!availability.isAvailable) {
      return princig;
    }

    princig.currentPrice = productData.data.pricing.value;
    princig.currentPriceUnit = productData.data.pricing.unitOfMeasure;

    if (
      productData.data.pricing.promotion &&
      productData.data.pricing.value < productData.data.pricing.original
    ) {
      princig.promoData.originalPrice = productData.data.pricing.original;
      if (productData.data.pricing.promotion.dates) {
        princig.promoData.dates.start =
          productData.data.pricing.promotion.dates.start;
        princig.promoData.dates.end =
          productData.data.pricing.promotion.dates.end;
      }
    } else {
      princig.promoData.originalPrice = null;
      princig.promoData.dates.start = null;
      princig.promoData.dates.end = null;
    }

    if (productData.data.pricing.alternate.unit.value) {
      princig.alternatePriceData.alternatePrice =
        productData.data.pricing.alternate.unit.value;
      princig.alternatePriceData.alternatePriceUnit =
        productData.data.pricing.alternate.unit.caseUnitOfMeasure;
    } else {
      princig.alternatePriceData.alternatePrice = null;
      princig.alternatePriceData.alternatePriceUnit = null;
    }

    return princig;
  }

  async function getSpecifications() {
    const specsGroups = productData.data.specificationGroup;
    let specs = new Object();
    for (const group of specsGroups) {
      specs[group.specTitle] = group.specifications.map((specs) => {
        let specGr = new Object();
        specGr["specName"] = specs.specName;
        specGr["specValue"] = specs.specValue;
        return specGr;
      });
    }
    return specs;
  }

  async function getVariations() {
    let variations = [];
    if (productData.variations) {
      const attributes = productData.variations.attributes;
      for (const attr of attributes) {
        let itemOption = new Object();
        itemOption[attr.attributeName] = attr.attributeValues.map(
          (el) => el.value
        );
        variations.push(itemOption);
      }
    }
    return variations;
  }

  /**************************************************************************************/

  const url = request.url;
  const title = await getTitle();
  const brand = await getBrand();
  const codes = await getCodes();
  const description = await getDescription();
  const images = await getImages();
  const pricing = await getPricing();
  const specifications = await getSpecifications();
  const variations = await getVariations();
  const availabilityInfo = await getAvailability();

  await Dataset.pushData({
    url,
    title,
    brand,
    codes,
    availabilityInfo,
    pricing,
    description,
    variations,
    images,
    specifications,
  });
});
