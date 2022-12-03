import { TextNode } from "node-html-parser";
import { BrowserContext, chromium, devices, Page } from "playwright";
import { shaynaKitDownloader } from "./downloader";
import { extractUrlFromNode, filterNodes, parseToHtml } from "./html";
import { Category, CategoryResult } from "./typings";
require("dotenv").config();

async function injectPageMiddleware(page: Page) {
  await page.route("**/*.{png,jpg,jpeg}", (route) => route.abort());
}

async function parseCategory(page: Page): Promise<Category> {
  const totalResults = await page.locator('p:has-text(" Showing ")');
  const totalResultsEl = await parseToHtml(totalResults);
  const totalResultsNodes = filterNodes(totalResultsEl.childNodes);
  const totalResultsCountEl = totalResultsNodes[totalResultsNodes.length - 1];
  const totalResultsCount = Number(
    (totalResultsCountEl.childNodes[0] as TextNode).rawText
  );

  const categoryResultsContainer = await page.locator(
    'div.container:has-text("Finish your projects faster")'
  );
  const categoryResultsNodes = filterNodes(
    (await parseToHtml(categoryResultsContainer)).childNodes[3].childNodes
  );
  const categoryResults = categoryResultsNodes.reduce<CategoryResult[]>(
    (pv, curr) => {
      const parentNodes = curr.childNodes[1].childNodes;
      // handle some results container missing badge-pro element
      const infoNode = (parentNodes[5] || parentNodes[3]).childNodes[1];
      const url = extractUrlFromNode(infoNode);
      const name = infoNode.childNodes[1].childNodes[0].rawText
        .replaceAll("\n", "")
        .trim();
      pv.push({ name: name, url: url });
      return pv;
    },
    []
  );
  return { results: categoryResults, totalResult: totalResultsCount };
}

async function scrapeCategory(
  context: BrowserContext,
  categoryUrl: string
): Promise<void> {
  const page = await context.newPage();
  const categoryName = categoryUrl.split("/").pop();
  try {
    await injectPageMiddleware(page);
    await page.goto(categoryUrl);
    console.log(`Starting to scrape category ${categoryName}`);
    let currentPage = await parseCategory(page);
    const totalPages = Math.ceil(
      currentPage.totalResult / currentPage.results.length
    );
    for (var i = 1; i <= totalPages; i++) {
      if (i !== 1) {
        await page.goto(`${categoryUrl}?page=${i}`);
        currentPage = await parseCategory(page);
      }
      for (var r of currentPage.results) {
        shaynaKitDownloader.queueDownload({
          category: categoryName,
          name: r.name,
          url: r.url,
        });
      }
    }
  } catch (e) {
    console.error(`Error when scraping category ${categoryName}. Error: ${e}`);
  } finally {
    await page.close();
  }
}

async function main() {
  //   const email = process.env.EMAIL;
  //   const password = process.env.PASSWORD;
  //   if (!email || !password) {
  //     throw new Error("You need to provide your email and password");
  //   }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext(devices["Desktop Chrome"]);
  const page = await context.newPage();

  //   await page.goto("https://shaynakit.com/login");
  //   await page.locator("#email").fill(email);
  //   await page.locator("#password").fill(password);
  //   await page.locator("button", { hasText: "LOG IN" }).click();

  //   const loginSuccess = (await page.url()) === "https://shaynakit.com/overview";
  //   if (!loginSuccess) {
  //     throw new Error("Failed to login, invalid email or password");
  //   }
  await injectPageMiddleware(page);
  await page.goto("https://shaynakit.com/landing");

  // fetch categories
  const categoryContainer = await page.locator(
    '.container:has-text("Categories")'
  );
  const categoryContainerHtml = await parseToHtml(categoryContainer);
  const categoryRowEl = filterNodes(categoryContainerHtml.childNodes)[1];
  const categoryUrls = filterNodes(categoryRowEl.childNodes).reduce(
    (pv, curr) => {
      const aHrefEl = filterNodes(curr.childNodes)[0];
      pv.push(extractUrlFromNode(aHrefEl));
      return pv;
    },
    []
  );

  await Promise.all(categoryUrls.map((url) => scrapeCategory(context, url)));
  await browser.close();
  await shaynaKitDownloader.onCompleted(() => {
    console.log("You are a bad boy now for scraping paid contents ;)");
  });
  process.exit(0);
}
main();
