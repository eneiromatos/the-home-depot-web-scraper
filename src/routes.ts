import { createPuppeteerRouter } from '@crawlee/puppeteer';

export const router = createPuppeteerRouter();


router.addHandler('LIST', async ({ log }) => {
    log.info(`Handle pagination`);
});

router.addHandler('DETAIL', async ({ request, page, log }) => {
    const title = await page.title();
    log.info(`Handle details: ${title} [${request.loadedUrl}]`);
});
