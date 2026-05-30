import puppeteer from 'puppeteer';
import { logger } from '../../utils/logger.js';

// Lazily-launched singleton browser — relaunched if it ever disconnects.
let browserPromise = null;

async function getBrowser() {
    if (browserPromise) {
        try {
            const b = await browserPromise;
            if (b.connected) return b;
        } catch {
            /* relaunch below */
        }
    }
    browserPromise = puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    return browserPromise;
}

export async function renderVoucherPdf(html) {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
        await page.setContent(html, { waitUntil: 'networkidle0' });
        return await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' },
        });
    } finally {
        await page.close().catch(() => {});
    }
}

export async function closeVoucherBrowser() {
    if (!browserPromise) return;
    try {
        const b = await browserPromise;
        await b.close();
    } catch (err) {
        logger.warn({ err: err?.message }, 'failed to close voucher browser');
    } finally {
        browserPromise = null;
    }
}
