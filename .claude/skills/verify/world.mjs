// Continuous-world engine regression. Bundles an isolated browser harness in memory;
// it adds no test globals or cheat controls to the shipped game.
import { build } from 'esbuild'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
const bundle = await build({ stdin: { contents: "export { DynastyBattle } from './src/game3/action/engine'; export { orderFor } from './src/game3/action/orders'; export { blocked, convoyRoute } from './src/game3/action/layout'", resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife', globalName: 'WorldTest', platform: 'browser' })
const browser = await chromium.launch()
try {
 const page = await browser.newPage()
 const errors=[]
 page.on('pageerror', e=>errors.push(e.message))
 await page.goto('http://localhost:8080/v3/')
 await page.addScriptTag({content:bundle.outputFiles[0].text})
 const result = await page.evaluate(() => {
   const check=(value,message)=>{if(!value) throw new Error(message)}
   const canvas=document.createElement('canvas');canvas.style.cssText='width:960px;height:640px';document.body.append(canvas)
   const event={id:'station',title:'驿站裁撤',body:'',source:'天灾 · 陕西',phase:'蛰伏',options:[{label:'带驿卒劫仓',detail:'',effect:{army:18,morale:-8}},{label:'游说县令赈灾',detail:'',effect:{morale:12,prestige:5}}]}
   const game=new WorldTest.DynastyBattle(canvas,()=>{});game.sound.muted=true
   const step=(seconds)=>{for(let t=0;t<seconds;t+=.02){if(game.status==='playing') game.update(.02)}}
   // Buildings are solid, so walk the roads the way a player would rather than straight through a house.
   const walk=(point)=>{
     const route=WorldTest.convoyRoute(game.player,point).slice(1)
     for(const [i,waypoint] of route.entries()){
       let attempts=0
       while(Math.hypot(game.player.x-waypoint.x,game.player.y-waypoint.y)>(i===route.length-1?25:40) && game.status==='playing' && attempts++<1200){
         const dx=waypoint.x-game.player.x,dy=waypoint.y-game.player.y,d=Math.hypot(dx,dy)
         game.setStick(dx/d,dy/d);step(.02)
       }
       check(attempts<1200,'Walking reaches target')
     }
     game.setStick(0,0)
   }
   const begin=(kind)=>{game.setEvent(event);game.beginOrder({kind,title:'执行测试',brief:'',target:{x:450,y:330},required:kind==='assault'||kind==='escort'?1:3})}
   game.setEvent(event)
   check(canvas.dataset.renderer==='3d','three.js renderer is active')
   const first=game.player.x;game.setStick(1,0);step(.5);check(game.player.x>first+80,'movement')
   // Camera-relative input: with the camera orbited to the east, "right" on the stick walks north.
   game.cameraYaw=Math.PI/2;const north=game.player.y;game.setStick(1,0);step(.3);game.setStick(0,0);game.cameraYaw=0
   check(game.player.y<north-40,'movement follows camera yaw')
   // Solid buildings: pushing north into the town hall from its doorstep stops at the wall.
   game.player.x=900;game.player.y=915;game.setStick(0,-1);step(1);game.setStick(0,0)
   check(game.player.y>=888&&!WorldTest.blocked(game.player),'town hall is solid')
   game.togglePause();const paused=game.player.x;step(.5);check(game.player.x===paused,'pause freezes movement');game.togglePause()
   game.interact();check(game.status==='playing','cannot interact from afar')
   walk(game.interactionTarget());game.interact();check(game.status==='decision','local event opens')
   check(WorldTest.orderFor(event,0).kind==='assault'&&WorldTest.orderFor(event,1).kind==='relief','same event has distinct option activities')
   begin('relief')
   for(let i=0;i<3;i++){walk(game.interactionTarget());game.interact();check(game.carrying,'collect supplies');walk(game.interactionTarget());game.interact()}
   check(game.status==='orderdone'&&game.orderSuccess,'relief delivers all three parcels')
   check(game.village.legacy.filter(l=>l.kind==='aid').length===3&&game.village.legacy.some(l=>l.kind==='kitchen'),'relief leaves supplies at each door and a kitchen in town')
   const position={x:game.player.x,y:game.player.y};game.setEvent({...event,id:'oath'})
   check(game.player.x===position.x&&game.player.y===position.y,'new event preserves world position')
   begin('council')
   for(let i=0;i<3;i++){walk(game.interactionTarget());game.interact();check(game.status==='audience','local audience');game.answerAudience(i!==1)}
   check(game.orderSuccess&&game.status==='orderdone','two supporters pass council')
   begin('council')
   for(let i=0;i<3;i++){walk(game.interactionTarget());game.interact();game.answerAudience(false)}
   check(!game.orderSuccess&&game.status==='orderdone','failed negotiation produces failure')
   check(game.village.legacy.some(l=>l.kind==='protest')&&game.village.people.some(p=>p.role==='protester'),'failed council leaves protesters at court')
   begin('ceremony');walk(game.interactionTarget());game.interact();walk(game.interactionTarget())
   game.interact();step(.1);game.releaseInteract();check(game.orderProgress===0,'offbeat ritual does not advance')
   for(let i=0;i<3;i++){game.interact();step(.8);game.releaseInteract()}
   check(game.orderSuccess&&game.status==='orderdone','ceremony completes through timing')
   check(game.village.legacy.some(l=>l.kind==='stele'&&l.title==='执行测试'),'edict is carved on a stele')
   begin('assault')
   let attempts=0
   while(game.enemies.length&&game.status==='playing'&&attempts++<16000){
     const target=game.enemies.reduce((a,b)=>Math.hypot(a.x-game.player.x,a.y-game.player.y)<Math.hypot(b.x-game.player.x,b.y-game.player.y)?a:b)
     const dx=target.x-game.player.x,dy=target.y-game.player.y,d=Math.hypot(dx,dy)
     game.setStick(d>70?dx/d:0,d>70?dy/d:0);game.cast('storm');game.cast('volley');step(.02)
   }
   check(!game.enemies.length,'combat clears garrison');walk({x:450,y:330});step(3.2)
   check(game.orderSuccess&&game.status==='orderdone','garrison captured without a boss')
   check(game.village.people.filter(p=>p.role==='guard').length>=2,'captured pass keeps a garrison')
   begin('escort');walk(game.interactionTarget());game.interact();check(game.wagon.active,'convoy accepts escort')
   // Cover the convoy; use actual attacks against its finite ambush.
   attempts=0;let offRoad=0
   while(game.status==='playing'&&attempts++<16000){
     const target=game.enemies[0]??game.wagon
     const dx=target.x-game.player.x,dy=target.y-game.player.y,d=Math.max(1,Math.hypot(dx,dy))
     game.setStick(d>50?dx/d:0,d>50?dy/d:0);game.cast('storm');game.cast('volley');step(.02)
     if(WorldTest.blocked(game.wagon,22)) offRoad++
   }
   check(game.orderSuccess&&game.status==='orderdone','convoy reaches town')
   check(offRoad===0,'convoy keeps to the road and never drives through a building')
   check(game.village.legacy.some(l=>l.kind==='supplies'),'delivered convoy unloads in town')
   begin('assault');game.player.invulnerable=0;game.hurt(10000)
   check(game.status==='orderdone'&&!game.orderSuccess,'wounded player produces mission setback')
   check(game.village.legacy.some(l=>l.kind==='scorched'),'lost assault scorches the pass')
   // Villagers talk about what has happened, and the realm changes who is out on the streets.
   game.setEvent(event);const villager=game.village.people.find(p=>p.role!=='protester');game.player.x=villager.x+20;game.player.y=villager.y+20
   game.interact();check(game.status==='playing'&&/「.+」/.test(game.notice),'villagers can be talked to')
   game.setRealm({military:90,politics:50,economy:90,destiny:90});const rich=game.village.people.filter(p=>p.role==='merchant').length
   game.setRealm({military:5,politics:50,economy:5,destiny:5});const poor=game.village.people.filter(p=>p.role==='merchant').length
   check(rich===5&&poor===1,'economy opens and closes market stalls')
   game.destroy();canvas.remove()
   return 'PASS: 3D renderer, movement, camera-relative input, solid buildings, pause, proximity, distinct choices, relief, council success/failure, ritual, garrison combat, escort on roads, defeat, continuous position, lasting village changes, villager talk, realm-driven market'
 })
 assert.deepEqual(errors,[])
 console.log(result)
} finally {await browser.close()}
