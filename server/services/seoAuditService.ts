import puppeteer from 'puppeteer';
import lighthouse from 'lighthouse';
import { URL } from 'url';

export class SeoAuditService {
  async runLighthouseAudit(url: string): Promise<any> {
    let browser = null;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle0' });

      const port = new URL(browser.wsEndpoint()).port;
      const result = await lighthouse(url, {
        port: parseInt(port, 10),
        output: 'json',
        onlyCategories: ['seo', 'performance', 'accessibility', 'best-practices'],
      });

      return result?.lhr;
    } catch (error) {
      console.error('Error running Lighthouse audit:', error);
      throw new Error('Failed to run Lighthouse audit.');
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}
