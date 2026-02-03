/**
 * Generate PWA icons from Lexora logo (gold L on dark blue).
 * Run: node scripts/generate-pwa-icons.js [path-to-source.png]
 *   or: PWA_ICON_SRC=path node scripts/generate-pwa-icons.js
 *   or: npm run generate-icons (uses src/assets/lexora-logo-gold.png or lexora-logo.png)
 * Requires: sharp, sharp-ico (devDependencies)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ICON_SIZES = [16, 32, 72, 96, 128, 144, 152, 192, 384, 512];
const OUT = path.join(ROOT, 'public/icons');
const PUBLIC = path.join(ROOT, 'public');

const CURSOR_GOLD_LOGO = process.platform === 'win32'
  ? path.join(process.env.USERPROFILE || '', '.cursor', 'projects', 'c-Users-lenovo-OneDrive-Desktop-LEXORA-lexora-law-main', 'assets', 'c__Users_lenovo_AppData_Roaming_Cursor_User_workspaceStorage_496d85eacbc20d294f8294ee2732735f_images_hf_20260203_080035_5c4558ac-6c78-4188-951d-c2af24b1be4b-eeb8ccb8-fd30-496f-b67b-36aa565e5ced.png')
  : null;

function getSourcePath() {
  const arg = process.argv[2];
  const env = process.env.PWA_ICON_SRC;
  if (arg && fs.existsSync(arg)) return arg;
  if (env && fs.existsSync(env)) return env;
  const gold = path.join(ROOT, 'src/assets/lexora-logo-gold.png');
  if (fs.existsSync(gold)) return gold;
  if (CURSOR_GOLD_LOGO && fs.existsSync(CURSOR_GOLD_LOGO)) {
    fs.mkdirSync(path.join(ROOT, 'src/assets'), { recursive: true });
    fs.copyFileSync(CURSOR_GOLD_LOGO, gold);
    return gold;
  }
  const fallback = path.join(ROOT, 'src/assets/lexora-logo.png');
  if (fs.existsSync(fallback)) return fallback;
  return null;
}

const SRC = getSourcePath();
if (!SRC) {
  console.warn('Source logo not found. Put your logo at src/assets/lexora-logo-gold.png or pass path: node scripts/generate-pwa-icons.js <path>');
  fs.mkdirSync(OUT, { recursive: true });
  process.exit(1);
}

let sharp;
let sharpIco;
try {
  sharp = (await import('sharp')).default;
  sharpIco = (await import('sharp-ico')).default;
} catch (e) {
  console.warn('Install deps: npm install sharp sharp-ico --save-dev');
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });

// Safe-area scale for maskable (logo ~80% of canvas, rest transparent)
const MASKABLE_SCALE = 0.8;

async function main() {
  const s = sharp(SRC);
  const meta = await s.metadata();
  const size = Math.min(meta.width ?? 512, meta.height ?? 512);

  // 1) Standard icons: 72, 96, 128, 144, 152, 192, 384, 512
  await Promise.all(
    ICON_SIZES.map((w) =>
      sharp(SRC).resize(w, w).png().toFile(path.join(OUT, `icon-${w}x${w}.png`))
    )
  );

  // 2) Maskable: logo at 80% with transparent padding
  for (const base of [192, 512]) {
    const logoSize = Math.round(base * MASKABLE_SCALE);
    const pad = Math.floor((base - logoSize) / 2);
    const logoBuf = await sharp(SRC).resize(logoSize, logoSize).toBuffer();
    await sharp({
      create: { width: base, height: base, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: logoBuf, left: pad, top: pad }])
      .png()
      .toFile(path.join(OUT, `icon-maskable-${base}.png`));
  }

  // 3) Favicon.ico: 32x32 and 16x16
  const p32 = sharp(SRC).resize(32, 32).png();
  const p16 = sharp(SRC).resize(16, 16).png();
  await sharpIco.sharpsToIco([p16, p32], path.join(PUBLIC, 'favicon.ico'), { sizes: [16, 32] });

  console.log('PWA icons + favicon.ico generated in public/ from', path.basename(SRC));
}

main().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
