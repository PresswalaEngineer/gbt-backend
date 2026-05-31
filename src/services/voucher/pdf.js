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
        // Use a system-installed Chromium when set (servers skip Puppeteer's own
        // browser download); falls back to the bundled browser locally.
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    return browserPromise;
}

// A4 @96dpi, with small margins, then auto-scaled DOWN so the whole voucher
// fits on a single page without dropping any content ("zoom to fit").
const A4_W = 794;
const A4_H = 1123;
const MARGIN_MM = 8;
const MM_PX = 3.7795;

export async function renderVoucherPdf(html) {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
        const marginPx = MARGIN_MM * MM_PX;
        const usableW = Math.round(A4_W - marginPx * 2);
        const usableH = A4_H - marginPx * 2;

        await page.setViewport({ width: usableW, height: 1000, deviceScaleFactor: 2 });
        await page.setContent(html, { waitUntil: 'networkidle0' });
        await page.emulateMediaType('print');

        const contentH = await page.evaluate(() => document.documentElement.scrollHeight);
        // Scale to fit one page; clamp so it never gets unreadably tiny.
        const scale = Math.max(0.45, Math.min(1, usableH / (contentH + 2)));

        return await page.pdf({
            format: 'A4',
            printBackground: true,
            scale,
            pageRanges: '1',
            margin: { top: `${MARGIN_MM}mm`, bottom: `${MARGIN_MM}mm`, left: `${MARGIN_MM}mm`, right: `${MARGIN_MM}mm` },
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
