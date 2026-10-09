// Generate PWA / home-screen icons into public/icons. Run: node scripts/generate-pwa-icons.mjs
import { mkdir } from "node:fs/promises"
import sharp from "sharp"

const BRAND = "#2b4c93"

function iconSvg(size, { maskable = false } = {}) {
  const radius = maskable ? 0 : Math.round(size * 0.22)
  const fontSize = Math.round(size * (maskable ? 0.42 : 0.52))
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${BRAND}"/>
  <text x="50%" y="50%" dy="0.35em" text-anchor="middle"
    font-family="Arial, Helvetica, sans-serif" font-weight="700"
    font-size="${fontSize}" fill="#ffffff">M</text>
</svg>`
}

const outputs = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "icon-maskable-512.png", size: 512, maskable: true },
  { file: "apple-touch-icon.png", size: 180, maskable: true },
  { file: "favicon-32.png", size: 32 },
]

await mkdir("public/icons", { recursive: true })
for (const { file, size, maskable } of outputs) {
  await sharp(Buffer.from(iconSvg(size, { maskable })))
    .png()
    .toFile(`public/icons/${file}`)
  console.log(`public/icons/${file}`)
}
