import { labels } from "./labels.js";
import { RequestOptions } from "crawlee";

export function getRequest(url: string, minPrice?: number, maxPrice?: number) {
  let finalRequest: RequestOptions = { url };
  let newURL = new URL(url);

  if (minPrice && maxPrice) {
    newURL.searchParams.set("upperbound", maxPrice.toString());
    newURL.searchParams.set("lowerbound", minPrice.toString());
  }

  if (url.includes("/b/" || url.includes("/s/"))) {
    // Case of category URL or Keyword URL
    finalRequest = { url: newURL.toString(), label: labels.listing };
  } else if (url.includes("/b/")) {
    // Case of product URL
    finalRequest = { url: newURL.toString(), label: labels.detail };
  }
  
  return finalRequest;
}
