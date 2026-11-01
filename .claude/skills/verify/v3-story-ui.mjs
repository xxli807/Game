// An isolated React/engine harness; no test controls ship in the game.
import { build } from 'esbuild'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
const shots = '/tmp/v3-stories'; mkdirSync(shots, { recursive: true })
const bundle = await build({ stdin: { contents: `
import React, { useState } from 'react'; import { createRoot } from 'react-dom/client';
import World from './src/game3/action/World'; import { DynastyBattle } from './src/game3/action/engine';
const original = DynastyBattle.prototype.setEvent;
DynastyBattle.prototype.setEvent = function(...args) { window.storyGame=this; this.sound.muted=true; return original.apply(this,args); };
document.getElementById('root').style.display='none';const host=document.createElement('div');document.body.append(host);
window.settlements=[];
function Harness() { const [turn,setTurn]=useState(0); return React.createElement(World, {
  event:{id:'station',title:'等待决断的政务',body:'地方正在等待你的决定。',source:'天灾 · 陕西',phase:'蛰伏',options:[{label:'带驿卒劫仓',detail:'',effect:{}},{label:'开仓赈济',detail:'',effect:{}}]},
  turn,monarch:'刘邦',resources:{military:50,politics:50,economy:50,destiny:60},log:[],active:'约法三章',activeUsed:true,onActive:()=>{},onExit:()=>{},
  onResolve:(...args)=>{window.settlements.push(args);setTurn(t=>t+1)}
}); }
createRoot(host).render(React.createElement(Harness));`, resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife', loader: { '.css': 'empty' }, define: { 'process.env.NODE_ENV': '"production"' } })
const browser = await chromium.launch()
try {
  for (const [width, fallback] of [[1280, false], [390, false], [390, true]]) {
    const page = await browser.newPage({ viewport: { width, height: 850 } })
    if (fallback) await page.addInitScript(()=>{const getContext=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:getContext.call(this,type,...args)}})
    const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
    await page.goto('http://localhost:8080/v3/')
    await page.addScriptTag({ content: bundle.outputFiles[0].text })
    await page.waitForFunction(()=>window.storyGame?.event)
    assert.equal(await page.locator('.world-canvas').getAttribute('data-renderer'),fallback?'2d':'3d')
    const interact = () => page.evaluate(()=>{const g=window.storyGame;Object.assign(g.player,g.interactionTarget());g.interact()})
    const deliver = async () => { await interact();for(const i of [2,0,1]){await page.evaluate(i=>window.storyGame.selectDelivery(i),i);await interact()} }
    await interact();await page.locator('.world-options button').nth(1).click();await deliver()
    await page.locator('.world-primary').click()
    await page.waitForFunction(()=>window.storyGame.turn===1&&!window.storyGame.order)
    await page.locator('.village-contacts summary').click()
    const contact=page.locator('.village-contacts button').filter({hasText:'沈桥'})
    assert.ok((await contact.innerText()).includes('新委托'))
    await contact.click();await interact();await page.waitForSelector('.story-cause')
    assert.ok((await page.locator('.story-cause').innerText()).includes('开仓赈济'))
    await page.locator('.world-options button').first().focus();await page.keyboard.press('Shift+Tab')
    assert.equal(await page.locator('.world-quiet').evaluate(el=>el===document.activeElement),true)
    await page.screenshot({path:`${shots}/offer-${width}${fallback?'-2d':''}.png`})
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
    await page.locator('.world-quiet').click();await interact()
    await page.locator('.world-options button').first().click()
    assert.ok((await page.locator('.world-objective').innerText()).includes('沈桥'))
    await deliver();await page.waitForSelector('.world-primary')
    assert.ok((await page.locator('.world-dialog').innerText()).includes('孩子们明日来念书'))
    await page.screenshot({path:`${shots}/result-${width}${fallback?'-2d':''}.png`})
    await page.locator('.world-primary').click()
    await page.waitForFunction(()=>!window.storyGame.order)
    assert.equal(await page.evaluate(()=>window.settlements.length),1,'a side quest never settles the pending main event')
    assert.equal(await page.evaluate(()=>window.storyGame.turn),1)
    assert.ok((await page.locator('.world-objective h1').innerText()).includes('等待决断'))
    assert.equal(await page.evaluate(()=>window.storyGame.village.legacy.some(l=>l.kind==='school')),true)
    await page.getByRole('button',{name:'暂停',exact:true}).click()
    await page.getByRole('button',{name:'查看起居注',exact:true}).click()
    assert.ok((await page.locator('.world-journal').innerText()).includes('义学'))
    assert.deepEqual(errors,[])
    console.log(`${width}px ${fallback?'2D':'3D'} PASS: outcome-linked request, contact tracking, defer/revisit, focus, playable branch, persistent school, story journal, main campaign preserved`)
    await page.close()
  }
} finally { await browser.close() }
