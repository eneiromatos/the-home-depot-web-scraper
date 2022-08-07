async function findSearchRequest(page: any) {
  //await page.waitForNetworkIdle()
  let searchResponse = await page.waitForResponse(
    (response) =>
      response.url().includes("searchModel") && response.status() === 200
  );
  const rawData = await searchResponse.buffer();
  const jsonData = await JSON.parse(rawData.toString());
  const responseData = jsonData.data.searchModel;

  return responseData;
}

async function findProductRequests(page: any) {
  //await page.waitForNetworkIdle()
  let productData: any = { data: {}, variations: {} };
  const productDataResponse = await page.waitForResponse(
    (response) =>
      response.url().includes("productClientOnlyProduct") &&
      response.status() === 200
  );
  const rawProductData = await productDataResponse.buffer();
  const jsonProdcutData = await JSON.parse(rawProductData.toString());
  productData.data = jsonProdcutData.data.product;

  const variationsDataResponse = await page.waitForResponse(
    (response) =>
      response.url().includes("mediaPriceInventory") &&
      response.status() === 200
  );
  const rawVariationData = await variationsDataResponse.buffer();
  const jsonVariationData = await JSON.parse(rawVariationData.toString());
  productData.variations =
    jsonVariationData.data.mediaPriceInventory.productDetailsList;

  return productData;
}

export { findProductRequests, findSearchRequest };
