// Renders index.html frame by frame (deterministic, via window.render(t)) to JPEGs,
// and writes the sound-effect cue list to events.json.
// Usage: node render.js <outDir> [fps]
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const outDir = path.resolve(process.argv[2] || path.join(__dirname, "build"));
const fps = +(process.argv[3] || 30);

(async () => {
  fs.mkdirSync(path.join(outDir, "frames"), { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto("file://" + path.join(__dirname, "index.html"));
  await page.evaluate(() => document.fonts.ready);
  const { events, duration } = await page.evaluate(() => ({ events: window.EVENTS, duration: window.DURATION }));
  fs.writeFileSync(path.join(outDir, "events.json"), JSON.stringify({ duration, events }, null, 1));

  const n = Math.round(duration * fps);
  for (let i = 0; i < n; i++) {
    await page.evaluate((t) => window.render(t), i / fps);
    await page.screenshot({
      path: path.join(outDir, "frames", `f_${String(i).padStart(5, "0")}.jpg`),
      type: "jpeg",
      quality: 92,
    });
    if (i % 150 === 0) console.log(`frame ${i}/${n}`);
  }
  await browser.close();
})();
