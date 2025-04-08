import puppeteer from 'puppeteer';

describe('PDF Report Download (Real Browser Simulation)', () => {
  let browser;
  let page;

  beforeAll(async () => {
    // Launch a real browser instance (non-headless for visual verification, can be headless if preferred)
    browser = await puppeteer.launch({
      headless: false,
      slowMo: 50,
    });
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser.close();
  });

  test('should trigger PDF download when save method is called', async () => {
    // Navigate to the page that triggers PDF generation.
    // Adjust the URL to match your local test server.
    await page.goto('http://localhost:1234/pdf-test-with-bipass.html');

    // Simulate user interaction that triggers PDF generation.
    // This assumes there is a button with id "generate-pdf" that when clicked,
    // calls the save() method on the report which creates the download link.
    await page.click('#generate-pdf');

    // Wait for the download link (with data URL) to appear.
    await page.waitForSelector('a[href^="data:application/pdf;base64,"]', { timeout: 5000 });

    // Extract the href from the download link.
    const downloadLinkHref = await page.$eval('a[href^="data:application/pdf;base64,"]', el => el.href);

    // Verify that the href starts with a valid PDF data URL.
    expect(downloadLinkHref).toMatch(/^data:application\/pdf;base64,/);
  }, 30000);
});