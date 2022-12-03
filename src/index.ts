import { chromium, devices } from "playwright";
import { extractUrlFromNode, filterNodes, parseToHtml } from "./html";
require("dotenv").config();

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const email = process.env.EMAIL;
  const password = process.env.PASSWORD;
  if (!email || !password) {
    throw new Error("You need to provide your email and password");
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext(devices["Desktop Chrome"]);
  const page = await context.newPage();

  await page.goto("https://shaynakit.com/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("button", { hasText: "LOG IN" }).click();

  const loginSuccess = (await page.url()) === "https://shaynakit.com/overview";
  if (!loginSuccess) {
    throw new Error("Invalid email or password");
  }
  await page.goto("https://shaynakit.com/landing");

  const downloadedContents: string[] = [];

  try {
    // fetch categories
    const categoryContainer = await page.locator(
      '.container:has-text("Categories")'
    );
    const categoryContainerHtml = await parseToHtml(categoryContainer);
    const categoryRowEl = filterNodes(categoryContainerHtml.childNodes)[1];
    const categoryUrls: string[] = filterNodes(categoryRowEl.childNodes).reduce(
      (pv, curr) => {
        const aHrefEl = filterNodes(curr.childNodes)[0];
        pv.push(extractUrlFromNode(aHrefEl));
        return pv;
      },
      []
    );

    async function scrapeCategory(categoryUrl: string) {
      const categoryPage = await context.newPage();
      try {
        await categoryPage.goto(categoryUrl);
      } catch (e) {
        console.error(`Error when scraping category ${e}`);
      } finally {
        // await categoryPage.close();
      }
    }
    await Promise.all(categoryUrls.map((url) => scrapeCategory(url)));
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
main();
