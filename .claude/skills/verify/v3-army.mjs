import { build } from 'esbuild'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const bundle = await build({ stdin: { contents: "export { DynastyBattle } from './src/game3/action/engine'", resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife', globalName: 'ArmyTest' })
const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto('http://localhost:8080/v3/');await page.addScriptTag({content:bundle.outputFiles[0].text})
  const result=await page.evaluate(()=>{
    const check=(x,m)=>{if(!x)throw Error(m)}
    const canvas=document.createElement('canvas');canvas.style.cssText='width:960px;height:640px';document.body.append(canvas)
    const game=new ArmyTest.DynastyBattle(canvas,()=>{});game.sound.muted=true
    const event={id:'oath',title:'等待中的盟约',source:'外交',phase:'蛰伏',body:'',options:[]}
    game.setEvent(event,0);Object.assign(game.player,game.interactionTarget());game.interact()
    check(game.status==='decision','conversation opens before battle')
    game.startFieldBattle();check(game.status==='playing','battle exits the conversation into live combat')
    check(game.allies.length===10&&game.enemies.length===12,'two real formations are created')
    const step=(n)=>{for(let i=0;i<n&&game.status==='playing';i++)game.update(.02)}
    const first=game.allies[0],start={x:first.x,y:first.y}
    game.commandArmy('hold');step(5)
    check(Math.hypot(first.x-start.x,first.y-start.y)<1,'hold preserves the line')
    game.commandArmy('follow');step(25)
    check(Math.hypot(first.x-start.x,first.y-start.y)>10,'follow moves the formation toward the player')
    game.commandArmy('advance');step(180)
    check(game.enemies.some(e=>e.hp<e.maxHp)||game.enemies.length<12,'friendly AI damages enemies')
    check(game.allies.some(a=>a.hp<a.maxHp)||game.allies.length<10,'enemies attack allied troops, not only the hero')
    game.togglePause();const frozen=game.allies.map(a=>[a.x,a.y,a.hp]);step(20)
    check(JSON.stringify(frozen)===JSON.stringify(game.allies.map(a=>[a.x,a.y,a.hp])),'pause freezes the army');game.togglePause()
    let attempts=0
    while(game.status==='playing'&&game.enemies.length&&attempts++<16000){
      const target=game.enemies.reduce((a,b)=>Math.hypot(a.x-game.player.x,a.y-game.player.y)<Math.hypot(b.x-game.player.x,b.y-game.player.y)?a:b)
      const dx=target.x-game.player.x,dy=target.y-game.player.y,d=Math.hypot(dx,dy)
      game.setStick(d>65?dx/d:0,d>65?dy/d:0);game.setAttack(true);game.cast('storm');game.cast('volley');step(1)
    }
    check(game.status==='playing'&&!game.enemies.length,'the player and army can win through combat')
    game.setStick(0,0);Object.assign(game.player,game.order.target);step(170)
    check(game.status==='orderdone'&&game.orderSuccess,'capture settles the battle')
    game.returnFromBattle();game.returnFromBattle()
    check(game.status==='playing'&&!game.order&&game.event===event&&game.turn===0,'return preserves the waiting main decision')
    game.startFieldBattle();check(!game.order,'the same turn cannot farm repeated garrisons')
    game.setEvent(event,1);game.startFieldBattle();game.player.invulnerable=0;game.hurt(10000)
    check(game.status==='orderdone'&&!game.orderSuccess,'player defeat produces a lost battle')
    game.returnFromBattle();check(game.player.hp>0&&game.status==='playing','a lost sortie returns control safely')
    game.destroy();canvas.remove();return 'PASS: 10 vs 12, hold/follow/advance, mutual damage, pause, playable victory/capture, defeat, safe campaign return and replay guard'
  })
  assert.deepEqual(errors,[]);console.log(result)
} finally {await browser.close()}
