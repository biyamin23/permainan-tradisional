// Screenshots of the kampung for review (see .github/workflows/screens.yml).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const shots = JSON.parse(readFileSync(new URL('./shots.json', import.meta.url)))
mkdirSync('screens-out', { recursive: true })

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})
const log = []
// the landing screen at common phone sizes (real fonts load here)
for (const [name, width, height] of [['se', 375, 667], ['i14', 390, 844], ['a360', 360, 780], ['tab', 820, 1180], ['wide', 1280, 720]]) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2, isMobile: width < 900, hasTouch: width < 900 })
  page.on('pageerror', (e) => log.push(`[landing ${name}] pageerror: ${e.message}`))
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)
  await page.screenshot({ path: `screens-out/landing-${name}.png` })
  await page.close()
}
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
    if (shot.map) {
      await page.keyboard.press('m')
      await page.waitForTimeout(1500)
      if (shot.pick) await page.getByRole('button', { name: shot.pick, exact: false }).first().click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: `screens-out/${viewport.name}-${shot.name}.png` })
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)
      continue
    }
    await page.evaluate((s) => {
      const k = window.__kampung
      if (s.hour !== undefined) k.hour(s.hour)
      if (s.camera) k.camera(s.camera.position, s.camera.target)
      else if (s.game) k.go(s.game)
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
