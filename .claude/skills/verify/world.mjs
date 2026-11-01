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
   walk(game.interactionTarget());game.interact();check(game.carrying&&game.cargoCount===3,'collect the full relief load once')
   for(const i of [2,0,1]){
     game.selectDelivery(i);walk(game.interactionTarget());game.interact()
     check(game.completed.has(i),'deliver in the selected non-default order')
     check(game.cargoCount===3-game.completed.size,'cargo decrements only when delivered')
     const count=game.orderProgress;game.interact();check(game.orderProgress===count,'cannot deliver twice to the same home')
   }
   check(!game.carrying&&game.cargoCount===0,'cargo clears when the last household receives aid')
   check(game.status==='orderdone'&&game.orderSuccess,'relief delivers all three parcels')
   const recipient=game.village.people.find(p=>p.memory)
   check(recipient&&game.village.talk(recipient,game).includes(recipient.memory.line),'a helped household remembers the delivery when spoken to')
   check(game.village.legacy.filter(l=>l.kind==='aid').length===3&&game.village.legacy.some(l=>l.kind==='kitchen'),'relief leaves supplies at each door and a kitchen in town')
   const position={x:game.player.x,y:game.player.y};game.setEvent({...event,id:'oath'})
   check(game.player.x===position.x&&game.player.y===position.y,'new event preserves world position')
   begin('council')
   for(let i=0;i<3;i++){walk(game.interactionTarget());game.interact();check(game.status==='audience','local audience');game.answerAudience(i===1?'defer':'concede')}
   check(game.orderSuccess&&game.status==='orderdone','two supporters pass council')
   check(game.councilSpent===2&&game.councilBudget()===0,'funded promises consume the limited budget')
   begin('council');check(game.councilSpent===0,'a new order clears previously settled promises')
   for(let i=0;i<2;i++){walk(game.interactionTarget());game.interact();game.answerAudience('concede')}
   walk(game.interactionTarget());game.interact();game.answerAudience('concede')
   check(game.status==='audience'&&game.orderProgress===2&&game.councilSpent===2,'cannot promise more than the available funds')
   game.answerAudience('defer');check(game.orderSuccess,'two supporters suffice without a third payment')
   game.setRealm({military:60,politics:60,economy:60,destiny:50});begin('council')
   for(let i=0;i<3;i++){walk(game.interactionTarget());game.interact();game.answerAudience('appeal')}
   check(game.orderSuccess&&game.trust===3&&game.councilSpent===0,'strong institutions earn support without extra funds')
   game.setRealm({military:30,politics:30,economy:3,destiny:50});begin('council')
   walk(game.interactionTarget());game.interact();game.answerAudience('concede')
   check(game.status==='audience'&&game.orderProgress===0&&game.councilSpent===0,'an empty treasury cannot fund a promise')
   game.answerAudience('appeal');check(game.trust===0,'unsupported appeals do not silently win support')
   game.setRealm({military:50,politics:50,economy:50,destiny:50})
   begin('council')
   for(let i=0;i<3;i++){walk(game.interactionTarget());game.interact();game.answerAudience('defer')}
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
     game.setStick(d>70?dx/d:0,d>70?dy/d:0);game.setAttack(true);game.cast('storm');game.cast('volley');step(.02)
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
     game.setStick(d>50?dx/d:0,d>50?dy/d:0);game.setAttack(true);game.cast('storm');game.cast('volley');step(.02)
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
   const originalEvent=game.event, originalTurn=game.turn, storiesBefore=game.stories.all().length
   game.trackContact('qiao');walk(game.interactionTarget());game.interact()
   check(game.status==='story'&&game.snapshot().story.id==='qiao','a named character offers a follow-up in the same village')
   game.closeStory();check(game.status==='playing'&&game.stories.offer('qiao',game.turn),'deferring a request preserves it')
   game.interact();game.beginStory('school')
   check(game.order.cargo==='义学物资'&&game.stories.active==='qiao','the branch starts a real delivery activity')
   walk(game.interactionTarget());game.interact()
   for(const i of [1,2,0]){game.selectDelivery(i);walk(game.interactionTarget());game.interact()}
   check(game.status==='orderdone'&&game.orderSuccess&&game.stories.current.result.includes('义学'),'the physical mission completes the chosen story')
   check(game.village.legacy.some(l=>l.kind==='school'),'the school remains in the world')
   game.finishStory();game.finishStory()
   check(game.status==='playing'&&!game.order&&game.event===originalEvent&&game.turn===originalTurn,'side-story settlement preserves the pending dynasty event and is idempotent')
   check(game.stories.all().length===storiesBefore&&!game.stories.offer('qiao',game.turn),'side missions cannot generate an infinite chain or repeat rewards')
   game.trackContact('qiao');walk(game.interactionTarget());game.interact()
   check(game.status==='playing'&&game.notice.includes('义学'),'the recurring character remembers the selected branch')
   game.destroy();canvas.remove()
   return 'PASS: 3D renderer, movement, camera-relative input, solid buildings, pause, proximity, distinct choices, relief, council success/failure, ritual, garrison combat, escort on roads, defeat, continuous position, lasting village changes, villager talk, realm-driven market'
 })
 assert.deepEqual(errors,[])
 console.log(result)
} finally {await browser.close()}
