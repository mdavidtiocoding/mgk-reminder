// Generate PWA / home-screen icons into public/icons. Run: node scripts/generate-pwa-icons.mjs
import { mkdir } from "node:fs/promises"
import sharp from "sharp"

const SOURCE = "assets/reminder-icon.png"

const outputs = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "icon-maskable-512.png", size: 512, maskable: true },
  { file: "apple-touch-icon.png", size: 180, maskable: true },
  { file: "favicon-32.png", size: 32 },
]

await mkdir("public/icons", { recursive: true })

for (const { file, size, maskable } of outputs) {
  const pad = maskable ? Math.round(size * 0.08) : 0
  const inner = size - pad * 2
  const resized = await sharp(SOURCE)
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toBuffer()

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: resized, left: pad, top: pad }])
    .png()
    .toFile(`public/icons/${file}`)

  console.log(`public/icons/${file}`)
}
