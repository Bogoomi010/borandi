// Playwright 기반 스크린샷 플레이테스트.
// 사용: 1) yarn/npm dev 서버 기동  2) node scripts/screenshots.mjs [baseURL]
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:5183";
const outDir = new URL("../output/shots/", import.meta.url).pathname;
mkdirSync(outDir, { recursive: true });

const executablePath = process.env.CHROME_PATH ?? undefined;
const browser = await chromium.launch({
  executablePath,
  args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("console", (m) => { if (m.type() === "error") console.log("[console.error]", m.text()); });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));

await page.goto(base, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${outDir}01-title.png` });

// 타이틀 → 시작
await page.mouse.click(640, 380 + 28);
await page.waitForTimeout(1200);
await page.screenshot({ path: `${outDir}02-stage-select.png` });

// 출정
await page.mouse.click(640, 720 - 84 + 27);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${outDir}03-battle-prep.png` });

// 소환 몇 번 + 시작
for (let i = 0; i < 6; i++) { await page.keyboard.press("KeyS"); await page.waitForTimeout(120); }
await page.keyboard.press("Space");
await page.waitForTimeout(4000);
await page.screenshot({ path: `${outDir}04-battle-combat.png` });

// 유닛 선택 (보드 중앙 근처 클릭 시도)
const clicked = await page.evaluate(() => {
  const api = window.__randi;
  return !!api;
});
console.log("api hook:", clicked);
for (let i = 0; i < 8; i++) { await page.keyboard.press("KeyS"); await page.waitForTimeout(100); }
await page.waitForTimeout(2500);
await page.screenshot({ path: `${outDir}05-battle-later.png` });

// 레시피 도감
await page.keyboard.press("KeyR");
await page.waitForTimeout(600);
await page.screenshot({ path: `${outDir}06-recipe-book.png` });
await page.keyboard.press("KeyR");

// 배속 + 진행
await page.keyboard.press("Digit3");
await page.waitForTimeout(15000);
await page.screenshot({ path: `${outDir}07-battle-progress.png` });

// 일시정지
await page.keyboard.press("Escape");
await page.waitForTimeout(500);
await page.screenshot({ path: `${outDir}08-pause.png` });

await browser.close();
console.log("done →", outDir);
