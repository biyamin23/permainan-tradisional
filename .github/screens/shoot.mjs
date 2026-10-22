// Screenshots of the kampung for review (see .github/workflows/screens.yml).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const shots = JSON.parse(readFileSync(new URL('./shots.json', import.meta.url)))
mkdirSync('screens-out', { recursive: true })

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const log = []
for (const viewport of [
  { name: 'phone', width: 390, height: 760, isMobile: true, hasTouch: true },
  { name: 'wide', width: 1280, height: 720 },
]) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.isMobile, hasTouch: viewport.hasTouch })
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') log.push(`[${viewport.name}] ${m.type()}: ${m.text()}`) })
  page.on('pageerror', (e) => log.push(`[${viewport.name}] pageerror: ${e.message}`))
  await page.goto('http://localhost:4173/?debug', { waitUntil: 'networkidle' })
  await page.waitForFunction(() => window.__kampung, null, { timeout: 60000 })
  await page.waitForTimeout(6000)
  for (const shot of shots) {
    if (shot.wideOnly && viewport.name !== 'wide') continue
    await page.evaluate((s) => {
      const k = window.__kampung
      if (s.hour !== undefined) k.hour(s.hour)
      if (s.camera) k.camera(s.camera.position, s.camera.target)
      else {
        k.camera(null)
        k.teleport(s.at[0], s.at[1], s.yaw ?? 0)
      }
    }, shot)
    await page.waitForTimeout(shot.wait ?? 2500)
    await page.screenshot({ path: `screens-out/${viewport.name}-${shot.name}.png` })
  }
  await page.close()
}
writeFileSync('screens-out/log.txt', log.join('\n') || 'no errors')
await browser.close()
