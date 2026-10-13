// Renders each scene in scenes.json to a 1080x1920 PNG using headless Chromium.
// Usage: node render_scenes.js <outDir>
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const dir = __dirname;
const outDir = path.resolve(process.argv[2] || path.join(dir, "build"));
const { scenes } = JSON.parse(fs.readFileSync(path.join(dir, "scenes.json"), "utf8"));

const font = (w) =>
  `@font-face{font-family:Cairo;font-weight:${w};src:url(data:font/woff2;base64,${fs
    .readFileSync(path.join(dir, "fonts", `cairo-arabic-${w}-normal.woff2`))
    .toString("base64")}) format("woff2");}`;

const css = `
${font(400)}${font(700)}${font(900)}
*{margin:0;box-sizing:border-box}
html,body{width:1080px;height:1920px}
body{font-family:Cairo,sans-serif;direction:rtl;color:#fff;overflow:hidden;
  background:radial-gradient(1200px 900px at 80% 10%,#3a1d6e 0%,transparent 60%),
             radial-gradient(1000px 900px at 10% 95%,#0f4c5c 0%,transparent 60%),#0d0b1e;
  display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 60px}
.top{position:absolute;top:150px;font-weight:700;font-size:46px;letter-spacing:1px;color:#ffc94d;
  border:4px solid #ffc94d;border-radius:60px;padding:10px 46px}
.badge{width:260px;height:260px;border-radius:50%;background:linear-gradient(135deg,#ffc94d,#ff7a59);
  color:#1a1030;font-weight:900;font-size:170px;line-height:250px;margin-bottom:70px;
  box-shadow:0 30px 80px rgba(255,122,89,.45)}
.line{font-weight:900;font-size:104px;line-height:1.45;white-space:nowrap;text-shadow:0 10px 40px rgba(0,0,0,.5)}
.line.hl{color:#ffc94d}
.line.last{color:#ffc94d}
.bar{position:absolute;bottom:170px;display:flex;gap:22px}
.dot{width:70px;height:14px;border-radius:7px;background:rgba(255,255,255,.22)}
.dot.on{background:#ffc94d}
`;

function html(s, i) {
  const lines = s.lines
    .map((l, j) => `<div class="line${s.kind === "intro" && j === 0 ? " hl" : ""}${s.kind !== "intro" && j === s.lines.length - 1 ? " last" : ""}">${l}</div>`)
    .join("");
  const badge = s.kind === "tip" ? `<div class="badge">${s.num}</div>` : "";
  const top = s.kind === "hook" ? `<div class="top">نصيحة النهارده</div>` : "";
  const dots = scenes.map((_, k) => `<div class="dot${k <= i ? " on" : ""}"></div>`).join("");
  return `<!doctype html><html lang="ar"><head><meta charset="utf-8"><style>${css}</style></head>
<body class="${s.kind}">${top}${badge}${lines}<div class="bar">${dots}</div></body></html>`;
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  for (let i = 0; i < scenes.length; i++) {
    await page.setContent(html(scenes[i], i), { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const file = path.join(outDir, `scene_${String(i + 1).padStart(2, "0")}.png`);
    await page.screenshot({ path: file });
    console.log(file);
  }
  await browser.close();
})();
