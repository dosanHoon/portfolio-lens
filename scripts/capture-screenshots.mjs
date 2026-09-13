import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "screenshots");
const demo = JSON.parse(readFileSync(join(root, "samples/demo-portfolio.json"), "utf8"));
demo.targets = { "인덱스": 50, "개별종목": 20, "현금": 25, "크립토": 5 };
demo.cashBand = { min: 20, max: 30 };

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.goto("http://localhost:8123/index.html", { waitUntil: "networkidle" });
await page.evaluate(({ demo }) => {
  localStorage.setItem("portfolio-lens-v3", JSON.stringify(demo));
  localStorage.setItem("portfolio-lens-tab", "analyze");
}, { demo });
await page.reload({ waitUntil: "networkidle" });

await page.screenshot({ path: join(outDir, "01-analyze-hero.png"), fullPage: false });

await page.evaluate(() => window.scrollTo(0, 420));
await page.waitForTimeout(300);
await page.screenshot({ path: join(outDir, "02-analyze-middle.png"), fullPage: false });

await page.evaluate(() => window.scrollTo(0, 1200));
await page.waitForTimeout(300);
await page.screenshot({ path: join(outDir, "03-analyze-bottom.png"), fullPage: false });

await page.click("#tab-manage");
await page.waitForTimeout(200);
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: join(outDir, "04-manage-input.png"), fullPage: false });

await page.setViewportSize({ width: 1280, height: 900 });
await page.click("#tab-analyze");
await page.waitForTimeout(200);
await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: join(outDir, "05-analyze-desktop.png"), fullPage: false });

await browser.close();
console.log("Saved screenshots to", outDir);
