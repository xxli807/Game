import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
mkdirSync('/tmp/v3-armies',{recursive:true})
const browser=await chromium.launch()
try {
  for(const [width,height] of [[1280,850],[390,850],[844,390]]) {
    if(process.argv.includes('--touch-only') && width===1280) continue
    if(process.argv.includes('--landscape-only') && height>width) continue
    if(process.argv.includes('--landscape-only') && width===1280) continue
    const page=await browser.newPage({viewport:{width,height},isMobile:width!==1280,hasTouch:width!==1280})
    const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
    await page.goto('http://localhost:8080/v3/')
    await page.locator('[data-mode="world"]').click()
    await page.waitForSelector('.world-canvas[data-characters="ready"]',{timeout:60000})
    await page.locator('.battle-launch').click()
    await page.waitForSelector('.army-controls')
    assert.equal(await page.locator('.world-modal').count(),0)
    assert.ok((await page.locator('.army-controls').innerText()).includes('敌军 12'))
    await page.getByRole('button',{name:/原地坚守/}).click()
    assert.equal(await page.getByRole('button',{name:/原地坚守/}).getAttribute('aria-pressed'),'true')
    await page.waitForTimeout(700)
    await page.screenshot({path:`/tmp/v3-armies/battle-${width}.png`})
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
    if(width!==1280) {
      assert.equal(await page.locator('.world-stick').isVisible(),true,'touchscreen joystick is visible')
      assert.ok(await page.evaluate(()=>{const stick=document.querySelector('.world-stick').getBoundingClientRect();return [...document.querySelectorAll('.army-controls button')].every(el=>{const r=el.getBoundingClientRect();return r.bottom<=stick.top||r.left>=stick.right})}), 'orders do not overlap the joystick')
    }
    assert.ok(await page.evaluate(()=>[...document.querySelectorAll('.combat-controls button,.world-actions button')].every(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth})), 'combat controls stay inside the viewport')
    await page.locator('.world-canvas').focus();await page.keyboard.press('2')
    await page.waitForFunction(()=>document.querySelector('.army-controls button:nth-child(2)')?.getAttribute('aria-pressed')==='true')
    await page.keyboard.press('1')
    const guard = page.getByRole('button',{name:'招架',exact:true})
    await guard.focus();await page.keyboard.down('Enter')
    await page.waitForFunction(()=>document.querySelector('.combat-guard')?.getAttribute('aria-pressed')==='true')
    await page.keyboard.up('Enter')
    await page.waitForFunction(()=>document.querySelector('.combat-guard')?.getAttribute('aria-pressed')==='false')
    const strike = page.getByRole('button',{name:'挥刀',exact:true})
    const bounds=await strike.boundingBox();await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2)
    await page.mouse.down();await page.waitForTimeout(180);await page.mouse.up()
    await page.locator('.world-canvas').focus();await page.keyboard.press('q');await page.keyboard.press('r')
    await page.keyboard.press('Escape');await page.waitForSelector('.world-modal')
    await page.getByRole('button',{name:'继续巡视',exact:true}).click()
    assert.deepEqual(errors,[])
    console.log(`${width}px PASS: immediate battle button, two armies, touch/keyboard commands, manual attack/guard, skills, pause, visible controls, no horizontal overflow or console errors`)
    await page.close()
  }
} finally {await browser.close()}
