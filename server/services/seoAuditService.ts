import puppeteer from 'puppeteer';
import lighthouse from 'lighthouse';
import { URL } from 'url';
import { execSync } from 'child_process';

export class SeoAuditService {
  private getChromiumPath(): string {
    try {
      // Try to find chromium in PATH
      const chromiumPath = execSync('which chromium', { encoding: 'utf-8' }).trim();
      return chromiumPath;
    } catch (error) {
      // Fallback to common paths if which fails
      console.warn('Could not find chromium in PATH, using fallback');
      return '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium';
    }
  }

  async runLighthouseAudit(url: string): Promise<any> {
    let browser = null;
    try {
      const chromiumPath = this.getChromiumPath();
      
      browser = await puppeteer.launch({
        headless: true,
        executablePath: chromiumPath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ],
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
