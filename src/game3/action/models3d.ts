import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { Building, UNIT } from './layout'

export const materials = {
  plaster: new T.MeshStandardMaterial({ color: '#b5a17c', roughness: .95 }),
  stone: new T.MeshStandardMaterial({ color: '#777c72', roughness: 1 }),
  wood: new T.MeshStandardMaterial({ color: '#583e2c', roughness: .85 }),
  red: new T.MeshStandardMaterial({ color: '#8e3930', roughness: .8 }),
  roof: new T.MeshStandardMaterial({ color: '#354d50', roughness: .72, metalness: .12, side: T.DoubleSide }),
  edge: new T.MeshStandardMaterial({ color: '#829286', roughness: .7 }),
  gold: new T.MeshStandardMaterial({ color: '#c6a663', roughness: .42, metalness: .5 }),
  dark: new T.MeshStandardMaterial({ color: '#252f2a', roughness: .9 }),
  leaf: new T.MeshStandardMaterial({ color: '#5f7948', roughness: 1, flatShading: true }),
  leafLight: new T.MeshStandardMaterial({ color: '#87925c', roughness: 1, flatShading: true }),
  skin: new T.MeshStandardMaterial({ color: '#bc9770', roughness: .85 }),
  jade: new T.MeshStandardMaterial({ color: '#365e59', roughness: .55, metalness: .3 }),
}
const cube = new T.BoxGeometry(1, 1, 1)
const sphere = new T.SphereGeometry(1, 10, 8)
const cylinder = new T.CylinderGeometry(1, 1, 1, 8)
export function mesh(parent: T.Object3D, geometry: T.BufferGeometry, material: T.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) {
  const m = new T.Mesh(geometry, material); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m
}
export const box = (parent: T.Object3D, material: T.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) => mesh(parent, cube, material, x, y, z, sx, sy, sz)
export function label(text: string, color = '#f2dfb4', width = 4) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96
  const ctx = canvas.getContext('2d')!; ctx.font = '600 40px "Songti SC", serif'; ctx.textAlign = 'center'
  ctx.fillStyle = '#12231bb8'; ctx.fillRect(50, 8, 412, 77); ctx.fillStyle = color; ctx.fillText(text, 256, 61)
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace
  const sprite = new T.Sprite(new T.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }))
  sprite.scale.set(width, width * .1875, 1); return sprite
}
function roof(parent: T.Group, width: number, depth: number, height: number, surfaces: typeof materials) {
  const rows = 10, columns = 18
  for (const side of [-1, 1]) {
    const geometry = new T.PlaneGeometry(width + 1.4, depth / 2 + .7, columns, rows)
    const p = geometry.attributes.position
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), t = (p.getY(i) + (depth / 2 + .7) / 2) / (depth / 2 + .7)
      const z = side * t * (depth / 2 + .7)
      const edgeLift = Math.pow(Math.abs(x) / ((width + 1.4) / 2), 6) * .42 * t
      p.setXYZ(i, x, height + 1.65 * Math.pow(1 - t, 2) + edgeLift, z)
    }
    const uv = geometry.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (width + 1.4) / 5, uv.getY(i))
    geometry.computeVertexNormals()
    mesh(parent, geometry, surfaces.roof, 0, 0, 0)
    for (let i = 0; i <= columns; i++) {
      const x = (i / columns - .5) * (width + 1.4)
      const points = Array.from({ length: 11 }, (_, j) => {
        const t = j / 10
        return new T.Vector3(x, height + 1.65 * (1 - t) ** 2 + Math.pow(Math.abs(x) / ((width + 1.4) / 2), 6) * .42 * t + .025, side * t * (depth / 2 + .7))
      })
      mesh(parent, new T.TubeGeometry(new T.CatmullRomCurve3(points), 10, .022, 3, false), surfaces.edge, 0, 0, 0)
    }
  }
  box(parent, surfaces.gold, 0, height + 1.7, 0, width + .5, .13, .18)
  for (const side of [-1, 1]) {
    const crest = mesh(parent, new T.ConeGeometry(.15, .65, 5), surfaces.gold, side * (width / 2 + .1), height + 1.95, 0)
    crest.rotation.z = side * -.45
  }
}
export function makeBuilding(building: Building, surfaces: typeof materials = materials) {
  const g = new T.Group(), w = building.width / UNIT, d = building.depth / UNIT
  g.position.set(building.x / UNIT, 0, building.y / UNIT)
  box(g, surfaces.stone, 0, .18, 0, w + .3, .36, d + .4)
  if (building.kind === 'altar') {
    for (let i = 0; i < 3; i++) box(g, surfaces.stone, 0, .3 + i * .2, 0, w - i * 1.8, .2, d - i * 1.2)
    const vessel = mesh(g, new T.CylinderGeometry(.9, .62, 1.1, 8), surfaces.jade, 0, 1.55, 0)
    vessel.rotation.y = Math.PI / 8
    for (const x of [-.6, .6]) for (const z of [-.4, .4]) box(g, surfaces.gold, x, .9, z, .16, .6, .16)
    for (const x of [-.9, .9]) { const h = mesh(g, new T.TorusGeometry(.25, .06, 5, 8), surfaces.gold, x, 2.12, 0); h.rotation.y = Math.PI / 2 }
    return g
  }
  const gate = building.kind === 'gate', h = gate ? 4.5 : building.kind === 'house' ? 2.6 : 3.6
  if (gate) {
    box(g, surfaces.stone, -w * .33, h / 2, 0, w * .34, h, d)
    box(g, surfaces.stone, w * .33, h / 2, 0, w * .34, h, d)
    box(g, surfaces.stone, 0, h - .4, 0, w, .8, d)
    box(g, surfaces.wood, 0, 1.7, d / 2 - .1, w * .32, 3.2, .3)
    for (let row = 0; row < 4; row++) for (let i = 0; i < 5; i++) mesh(g, sphere, surfaces.gold, -.8 + i * .4, .6 + row * .7, d / 2 + .08, .055, .055, .04)
  } else {
    box(g, surfaces.plaster, 0, h / 2, -.25, w - .4, h, d - 1)
    box(g, surfaces.wood, 0, 1.4, d / 2 - .7, w * .25, 2.5, .16)
    for (const x of [-w * .31, w * .31]) {
      box(g, surfaces.dark, x, 1.8, d / 2 - .73, w * .19, 1.15, .18)
      for (let i = -2; i <= 2; i++) box(g, surfaces.wood, x + i * w * .036, 1.8, d / 2 - .6, .06, 1.2, .08)
      box(g, surfaces.wood, x, 1.8, d / 2 - .6, w * .2, .06, .08)
    }
    for (let i = 0; i < 4; i++) mesh(g, cylinder, surfaces.red, (i / 3 - .5) * (w - .4), h / 2, d / 2 + .1, .12, h, .12)
    box(g, surfaces.red, 0, h - .2, d / 2 + .1, w, .25, .22)
  }
  roof(g, w, d, h, surfaces)
  for (let i = 0; i < 3; i++) box(g, surfaces.stone, 0, .07 * (3 - i), d / 2 + .5 + i * .28, w * .42, .14, .35)
  for (const x of [-w / 2 + .4, w / 2 - .4]) {
    mesh(g, new T.CylinderGeometry(.22, .28, .5, 8), new T.MeshStandardMaterial({ color: '#ce7840', emissive: '#994219', emissiveIntensity: .5 }), x, h - .65, d / 2 + .3)
    box(g, surfaces.dark, x, h - .95, d / 2 + .3, .16, .07, .16)
  }
  if (building.name) { const sign = label(building.name, '#ecd09c', 2.6); sign.position.set(0, h - .45, d / 2 + .4); g.add(sign) }
  if (building.kind === 'granary') for (let i = 0; i < 6; i++) mesh(g, sphere, new T.MeshStandardMaterial({ color: '#bba370', roughness: 1 }), -w * .32 + (i % 3) * .55, .5 + Math.floor(i / 3) * .5, d / 2 + .4, .4, .5, .35)
  return g
}
export type ActorRig = { root: T.Group; leftLeg: T.Group; rightLeg: T.Group; leftArm: T.Group; rightArm: T.Group; cape: T.Mesh; sword: T.Group }
export function makeActor(role: 'player' | 'civilian' | 'soldier' | 'archer' | 'brute', tint = '#8b9273'): ActorRig {
  const root = new T.Group(), armored = role !== 'civilian', player = role === 'player'
  const cloth = new T.MeshStandardMaterial({ color: player ? '#962f2f' : tint, roughness: .85 })
  const armor = player ? materials.jade : materials.dark
  const torso = mesh(root, new T.CylinderGeometry(.3, .25, .66, 8), armored ? armor : cloth, 0, 1.12, 0, 1, 1, .75)
  torso.rotation.y = Math.PI / 8
  mesh(root, new T.CylinderGeometry(.26, .4, .45, 8), cloth, 0, .74, 0, 1, 1, .85)
  box(root, materials.gold, 0, .88, .01, .56, .07, .43)
  if (armored) for (let i = 0; i < 4; i++) box(root, materials.gold, 0, 1.02 + i * .1, .24, .48, .018, .02)
  mesh(root, sphere, materials.skin, 0, 1.65, .015, .2, .25, .18)
  mesh(root, sphere, materials.dark, 0, 1.79, -.025, .21, .14, .19)
  mesh(root, sphere, materials.dark, 0, 1.94, -.025, .085, .1, .085)
  for (const x of [-.068, .068]) box(root, materials.dark, x, 1.68, .178, .035, .025, .018)
  mesh(root, sphere, materials.skin, 0, 1.61, .182, .04, .06, .04)
  if (player) {
    box(root, materials.dark, 0, 1.47, .16, .16, .14, .045)
    // Lamellar plates, headband and a red plume make the commander recognizable.
    for (let row = 0; row < 3; row++) for (let col = 0; col < 5; col++) {
      box(root, materials.edge, (col - 2) * .085, 1.01 + row * .11, .245, .07, .09, .025)
    }
    mesh(root, new T.CylinderGeometry(.216, .216, .055, 12), materials.gold, 0, 1.8, -.02)
    const plume = mesh(root, new T.ConeGeometry(.07, .43, 7), cloth, 0, 2.08, -.08)
    plume.rotation.x = -.4
  }
  const legs = [-1, 1].map(side => {
    const pivot = new T.Group(); pivot.position.set(side * .155, .7, 0); root.add(pivot)
    mesh(pivot, cylinder, cloth, 0, -.24, 0, .115, .5, .12)
    box(pivot, materials.dark, 0, -.58, .055, .22, .24, .36)
    return pivot
  })
  const arms = [-1, 1].map(side => {
    const pivot = new T.Group(); pivot.position.set(side * .34, 1.38, 0); root.add(pivot)
    mesh(pivot, sphere, armored ? materials.gold : cloth, 0, -.05, 0, .18, .17, .2)
    mesh(pivot, cylinder, cloth, 0, -.24, 0, .1, .4, .1)
    mesh(pivot, sphere, materials.skin, 0, -.48, .015, .09, .12, .09)
    return pivot
  })
  const capeGeometry = new T.PlaneGeometry(.72, .9, 5, 5)
  const cape = new T.Mesh(capeGeometry, new T.MeshStandardMaterial({ color: '#8d302d', roughness: .85, side: T.DoubleSide }))
  cape.position.set(0, 1.02, -.28); cape.rotation.x = -.15; root.add(cape); cape.visible = player; cape.castShadow = true
  const sword = new T.Group(); sword.position.set(0, -.43, .04); arms[1].add(sword)
  if (armored) {
    box(sword, materials.wood, 0, 0, .11, .075, .075, .25)
    box(sword, materials.gold, 0, 0, .25, .26, .06, .06)
    const blade = box(sword, new T.MeshStandardMaterial({ color: '#d8dfcf', metalness: .8, roughness: .24 }), 0, .01, .77, .12, .045, 1.02)
    blade.rotation.y = -.04
  }
  if (role === 'archer') {
    sword.visible = false
    const bow = mesh(arms[0], new T.TorusGeometry(.45, .035, 4, 16, Math.PI), materials.wood, 0, -.4, .15)
    bow.rotation.y = Math.PI / 2
  }
  if (role === 'brute') root.scale.setScalar(1.25)
  root.traverse(object => { if (object instanceof T.Mesh) { object.castShadow = true; object.receiveShadow = true } })
  return { root, leftLeg: legs[0], rightLeg: legs[1], leftArm: arms[0], rightArm: arms[1], cape, sword }
}
// Static architecture and foliage are merged by material to keep draw calls low.
export function mergeStatic(group: T.Group) {
  group.updateMatrixWorld(true)
  const batches = new Map<T.Material, T.BufferGeometry[]>()
  const meshes: T.Mesh[] = []
  group.traverse(object => {
    if (!(object instanceof T.Mesh) || Array.isArray(object.material)) return
    const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld)
    const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry
    const batch = batches.get(object.material) ?? []; batch.push(nonIndexed); batches.set(object.material, batch); meshes.push(object)
    if (nonIndexed !== geometry) geometry.dispose()
  })
  for (const m of meshes) m.removeFromParent()
  const merged = new T.Group()
  for (const [material, geometries] of batches) {
    const geometry = mergeGeometries(geometries)
    geometries.forEach(g => g.dispose())
    if (geometry) mesh(merged, geometry, material, 0, 0, 0)
  }
  return merged
}

// ---- Village pieces (villagers, market, props, and the structures dynasty choices leave behind) ----
const robeGeometry = new T.CylinderGeometry(.2, .34, .86, 8)
const torsoGeometry = new T.CylinderGeometry(.22, .2, .42, 8)
const hatGeometry = new T.ConeGeometry(.44, .2, 10)
const cone4 = new T.ConeGeometry(1, 1, 4)
const cone6 = new T.ConeGeometry(1, 1, 6)
const disc = new T.CircleGeometry(1, 20)
const puffGeometry = new T.IcosahedronGeometry(1, 0)
export const straw = new T.MeshStandardMaterial({ color: '#b99b5c', roughness: 1 })
const canvasCloth = new T.MeshStandardMaterial({ color: '#c9b894', roughness: 1, side: T.DoubleSide })
const earth = new T.MeshStandardMaterial({ color: '#9c8460', roughness: 1 })
const soot = new T.MeshStandardMaterial({ color: '#1f1c19', roughness: 1, transparent: true, opacity: .75 })
const smoke = new T.MeshStandardMaterial({ color: '#8f8a80', roughness: 1, transparent: true, opacity: .45, depthWrite: false })
const flame = new T.MeshStandardMaterial({ color: '#ffb35c', emissive: '#ff7a1f', emissiveIntensity: 2.2 })
const lanternGlow = new T.MeshStandardMaterial({ color: '#f0a25a', emissive: '#e0681f', emissiveIntensity: 1.6 })
const tinted = new Map<string, T.MeshStandardMaterial>()
// Shared resources are never disposed with a rig or prop; everything else they own is.
const SHARED = new Set<object>([cube, sphere, cylinder, robeGeometry, torsoGeometry, hatGeometry, cone4, cone6, disc, puffGeometry, straw, canvasCloth, earth, soot, smoke, flame, lanternGlow, ...Object.values(materials)])
export function tint(color: string) {
  let m = tinted.get(color)
  if (!m) { m = new T.MeshStandardMaterial({ color, roughness: .9 }); tinted.set(color, m); SHARED.add(m) }
  return m
}
export function disposeObject(root: T.Object3D) {
  root.traverse(object => {
    const item = object as T.Object3D & { geometry?: T.BufferGeometry; material?: T.Material | T.Material[] }
    // Sprites share one internal geometry, so only their materials are released.
    if (item.geometry && !(object instanceof T.Sprite) && !SHARED.has(item.geometry)) item.geometry.dispose()
    for (const m of item.material ? Array.isArray(item.material) ? item.material : [item.material] : []) {
      if (SHARED.has(m)) continue
      ;(m as T.MeshStandardMaterial).map?.dispose(); m.dispose()
    }
  })
}
export function glyphs(text: string, options: { vertical?: boolean; color?: string; background?: string; size?: number } = {}) {
  const chars = [...text].slice(0, 9), vertical = options.vertical ?? false, size = options.size ?? 96
  const canvas = document.createElement('canvas')
  canvas.width = vertical ? size * 1.4 : size * Math.max(1, chars.length) * 1.1 + size * .4; canvas.height = vertical ? size * chars.length * 1.1 + size * .5 : size * 1.5
  const ctx = canvas.getContext('2d')!
  if (options.background) { ctx.fillStyle = options.background; ctx.fillRect(0, 0, canvas.width, canvas.height) }
  ctx.fillStyle = options.color ?? '#2a211a'; ctx.font = `700 ${size}px "Songti SC", "Noto Serif SC", serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  if (vertical) chars.forEach((c, i) => ctx.fillText(c, canvas.width / 2, size * .8 + i * size * 1.1))
  else ctx.fillText(chars.join(''), canvas.width / 2, canvas.height / 2)
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace
  return { texture, aspect: canvas.width / canvas.height }
}
function plaque(parent: T.Object3D, text: string, x: number, y: number, z: number, height: number, options: Parameters<typeof glyphs>[1] = {}) {
  const { texture, aspect } = glyphs(text, options)
  return mesh(parent, new T.PlaneGeometry(height * aspect, height), new T.MeshStandardMaterial({ map: texture, roughness: .9, side: T.DoubleSide }), x, y, z)
}
export type Rig = { root: T.Group; body: T.Group; leftLeg: T.Group; rightLeg: T.Group; leftArm: T.Group; rightArm: T.Group }
export function makeVillager(role: string, color: string): Rig {
  const root = new T.Group(), body = new T.Group(), robe = tint(color); root.add(body)
  mesh(body, robeGeometry, robe, 0, .78, 0)
  mesh(body, torsoGeometry, robe, 0, 1.3, 0)
  box(body, materials.dark, 0, 1.08, 0, .44, .06, .34)
  mesh(body, sphere, materials.skin, 0, 1.64, .01, .17, .2, .16)
  mesh(body, sphere, materials.dark, 0, 1.74, -.03, .17, .12, .16)
  if (role === 'farmer' || role === 'settler' || role === 'child') mesh(body, hatGeometry, straw, 0, 1.86, 0)
  if (role === 'elder') { mesh(body, sphere, tint('#e6e0cf'), 0, 1.48, .12, .09, .14, .06); mesh(body, cylinder, materials.dark, 0, 1.83, -.02, .13, .1, .13) }
  if (role === 'merchant') mesh(body, cylinder, tint('#3b3129'), 0, 1.84, -.02, .16, .12, .16)
  if (role === 'official') { box(body, materials.dark, 0, 1.86, -.03, .3, .16, .26); box(body, materials.dark, 0, 1.88, -.1, .74, .04, .06) }
  if (role === 'protester') box(body, tint('#e7dcc2'), 0, 1.72, 0, .36, .05, .33)
  const legs = [-1, 1].map(side => { const pivot = new T.Group(); pivot.position.set(side * .11, .5, 0); body.add(pivot); box(pivot, materials.dark, 0, -.25, .03, .12, .5, .16); return pivot })
  const arms = [-1, 1].map(side => {
    const pivot = new T.Group(); pivot.position.set(side * .27, 1.44, 0); body.add(pivot)
    mesh(pivot, cylinder, robe, 0, -.2, 0, .09, .42, .09); mesh(pivot, sphere, materials.skin, 0, -.44, .01, .07, .08, .07)
    return pivot
  })
  if (role === 'protester') { const sign = new T.Group(); sign.position.set(0, -.4, .1); arms[1].add(sign); mesh(sign, cylinder, materials.wood, 0, .55, 0, .03, 1.5, .03); plaque(sign, '请命', 0, 1.2, .04, .42, { background: '#e9dcbd', size: 80 }) }
  if (role === 'child') root.scale.setScalar(.72)
  root.traverse(o => { if (o instanceof T.Mesh) o.castShadow = true })
  return { root, body, leftLeg: legs[0], rightLeg: legs[1], leftArm: arms[0], rightArm: arms[1] }
}
export function makeStall(color: string) {
  const g = new T.Group(), open = new T.Group(), closed = new T.Group(); open.name = 'open'; closed.name = 'closed'; g.add(open, closed)
  for (const x of [-1.1, 1.1]) for (const z of [-.7, .7]) box(g, materials.wood, x, .9, z, .1, 1.8, .1)
  box(g, materials.wood, 0, .8, -.1, 2.3, .12, 1.1)
  const awning = box(open, tint(color), 0, 1.95, -.25, 2.6, .07, 1.8); awning.rotation.x = -.22
  for (let i = 0; i < 5; i++) mesh(open, sphere, tint(['#c8963a', '#a14a2f', '#7c8a3e', '#d0b36a', '#8b5a3a'][i]), -.8 + i * .4, .98, -.2, .14, .12, .14)
  box(open, straw, .6, 1.02, .2, .5, .3, .35)
  box(closed, materials.wood, 0, 1.3, -.62, 2.3, 1, .06)
  for (let i = 0; i < 5; i++) box(closed, materials.dark, -.9 + i * .45, 1.3, -.58, .04, .96, .04)
  g.traverse(o => { if (o instanceof T.Mesh) { o.castShadow = true; o.receiveShadow = true } })
  return g
}
export function makeWell() {
  const g = new T.Group()
  mesh(g, new T.CylinderGeometry(.95, 1.05, .8, 14, 1, true), materials.stone, 0, .4, 0).material = new T.MeshStandardMaterial({ color: '#777c72', roughness: 1, side: T.DoubleSide })
  mesh(g, new T.TorusGeometry(1, .12, 6, 16), materials.stone, 0, .8, 0).rotation.x = Math.PI / 2
  mesh(g, disc, tint('#23332f'), 0, .25, 0, .95, .95, .95).rotation.x = -Math.PI / 2
  for (const x of [-.9, .9]) box(g, materials.wood, x, 1.3, 0, .12, 1.8, .12)
  box(g, materials.wood, 0, 2.15, 0, 2, .12, .12)
  const r = mesh(g, cone4, materials.roof, 0, 2.55, 0, 1.6, .6, 1); r.rotation.y = Math.PI / 4
  mesh(g, cylinder, materials.wood, .2, 1.5, 0, .12, .3, .12)
  return g
}
export function makeCart() {
  const g = new T.Group(), wheels: T.Mesh[] = []
  box(g, materials.wood, 0, .85, 0, 1.6, .18, 2.4)
  for (const x of [-.78, .78]) box(g, materials.wood, x, 1.1, 0, .08, .4, 2.4)
  for (let i = 0; i < 4; i++) mesh(g, sphere, straw, -.4 + (i % 2) * .8, 1.25, -.7 + Math.floor(i / 2) * .9, .42, .36, .5)
  box(g, canvasCloth, 0, 1.5, .5, 1.3, .3, 1)
  for (const x of [-.95, .95]) { const w = mesh(g, new T.CylinderGeometry(.55, .55, .12, 12), materials.dark, x, .55, 0); w.rotation.z = Math.PI / 2; wheels.push(w) }
  for (const x of [-.35, .35]) box(g, materials.wood, x, .8, 1.8, .07, .07, 1.4)
  g.traverse(o => { if (o instanceof T.Mesh) o.castShadow = true })
  return { root: g, wheels }
}
export function makeBanner() {
  const g = new T.Group()
  mesh(g, cylinder, materials.wood, 0, 2.2, 0, .07, 4.4, .07)
  mesh(g, sphere, materials.gold, 0, 4.45, 0, .12, .12, .12)
  const cloth = new T.Mesh(new T.PlaneGeometry(1.5, 1, 10, 4), new T.MeshStandardMaterial({ side: T.DoubleSide, roughness: .85 }))
  cloth.geometry.translate(.78, 0, 0); cloth.position.set(0, 3.7, 0); cloth.castShadow = true; g.add(cloth)
  const textures = { held: glyphs('守', { color: '#f2d79c', background: '#8e3930', size: 110 }).texture, owned: glyphs('鼎', { color: '#f2d79c', background: '#365e59', size: 110 }).texture }
  return { root: g, cloth, textures, base: Float32Array.from(cloth.geometry.attributes.position.array) }
}
function puffs(parent: T.Object3D, x: number, y: number, z: number, count = 4, material = smoke) {
  for (let i = 0; i < count; i++) { const p = mesh(parent, puffGeometry, material, x, y, z, .3, .3, .3); p.castShadow = false; p.userData.puff = { phase: i / count, x, y, z } }
}
function tent(parent: T.Object3D, material: T.Material, x: number, z: number, size = 1) {
  const t = mesh(parent, cone4, material, x, .9 * size, z, 1.3 * size, 1.8 * size, 1.3 * size); t.rotation.y = Math.PI / 4
  box(parent, materials.dark, x, .45 * size, z + .92 * size, .5 * size, .8 * size, .02)
}
function fire(parent: T.Object3D, x: number, z: number) {
  for (let i = 0; i < 7; i++) mesh(parent, sphere, materials.stone, x + Math.cos(i) * .4, .08, z + Math.sin(i) * .4, .14, .1, .14)
  const f = mesh(parent, new T.ConeGeometry(.22, .6, 6), flame, x, .35, z); f.castShadow = false; f.userData.flicker = true
  puffs(parent, x, 1, z, 3)
}
function pavilion(parent: T.Object3D, sides: number, radius: number, sign: string) {
  for (let i = 0; i < sides; i++) { const a = i / sides * Math.PI * 2 + Math.PI / sides; mesh(parent, cylinder, materials.red, Math.cos(a) * radius, 1.2, Math.sin(a) * radius, .1, 2.4, .1) }
  mesh(parent, cylinder, materials.stone, 0, .12, 0, radius + .4, .24, radius + .4)
  const r = mesh(parent, sides === 4 ? cone4 : cone6, materials.roof, 0, 2.95, 0, radius + .8, 1.1, radius + .8); r.rotation.y = Math.PI / sides
  mesh(parent, sphere, materials.gold, 0, 3.55, 0, .14, .2, .14)
  plaque(parent, sign, 0, 2.2, radius + .05, .45, { color: '#f0d49a', background: '#3a2a20', size: 80 })
}
// One structure per kind of outcome. `count` grows piles instead of cluttering the map with duplicates.
export function makeLegacy(kind: string, title: string, count: number) {
  const g = new T.Group(), more = Math.min(4, count)
  switch (kind) {
    case 'garrison': {
      mesh(g, cylinder, materials.wood, 0, 1.8, 0, .06, 3.6, .06)
      plaque(g, '鼎', .55, 3, 0, .9, { color: '#f2d79c', background: '#365e59', size: 110 })
      for (const x of [.9, 1.9]) box(g, materials.wood, x, .7, .6, .08, 1.4, .08)
      box(g, materials.wood, 1.4, 1.2, .6, 1.1, .08, .08)
      for (let i = 0; i < 3; i++) { const s = box(g, materials.edge, 1.05 + i * .35, 1, .66, .04, 2, .04); s.rotation.z = .12 }
      break
    }
    case 'scorched': {
      mesh(g, disc, soot, 0, .03, 0, 2.2, 2.2, 2.2).rotation.x = -Math.PI / 2
      for (let i = 0; i < 4; i++) { const p = box(g, materials.dark, Math.cos(i * 1.7) * .9, .12, Math.sin(i * 1.7) * .7, 1.4, .12, .2); p.rotation.y = i * .8; p.rotation.z = .15 }
      puffs(g, 0, 1, 0, 5)
      break
    }
    case 'supplies': {
      for (let i = 0; i < 2 + more; i++) box(g, materials.wood, (i % 3) * .75 - .75, .35 + Math.floor(i / 3) * .7, (i % 2) * .3, .7, .7, .7)
      for (let i = 0; i < 3; i++) mesh(g, sphere, straw, -1.3 + i * .35, .35, .9, .32, .35, .32)
      break
    }
    case 'wreck': {
      const body = box(g, materials.wood, 0, .5, 0, 1.6, .18, 2.4); body.rotation.z = .45; body.rotation.y = .3
      const wheel = mesh(g, new T.CylinderGeometry(.55, .55, .12, 12), materials.dark, 1.2, .08, .8); wheel.rotation.x = .1
      for (let i = 0; i < 3; i++) mesh(g, sphere, straw, -1 + i * .6, .25, -1.1 + i * .3, .38, .28, .38)
      mesh(g, disc, soot, 0, .03, 0, 1.8, 1.8, 1.8).rotation.x = -Math.PI / 2
      puffs(g, .2, 1, 0, 4)
      break
    }
    case 'settlers': {
      tent(g, canvasCloth, 0, 0, 1); if (count > 1) tent(g, straw, 2.4, .6, .85)
      fire(g, 1.2, 1.9)
      for (let i = 0; i < 3; i++) mesh(g, sphere, tint('#8a7556'), -1.4 + i * .3, .25, 1.3, .25, .22, .25)
      break
    }
    case 'clinic': {
      tent(g, tint('#e6ddc6'), 0, 0, 1.2)
      for (const x of [1.8, 2.8]) { mesh(g, cylinder, materials.wood, x, .7, .4, .05, 1.4, .05); for (let i = 0; i < 3; i++) mesh(g, cylinder, straw, x, .45 + i * .38, .4, .42, .04, .42) }
      mesh(g, cylinder, materials.wood, -1.8, 1.3, 1, .05, 2.6, .05)
      plaque(g, '医', -1.8, 2.1, 1.06, .7, { color: '#8e3930', background: '#efe4c8', size: 110 })
      break
    }
    case 'rampart': {
      box(g, earth, 0, .75, 0, 3.6, 1.5, .9)
      for (let i = 0; i < 4; i++) box(g, tint('#8a7352'), 0, .2 + i * .37, .46, 3.6, .04, .02)
      for (const x of [-1.9, 1.9]) box(g, materials.wood, x, 1.1, .6, .09, 2.2, .09)
      box(g, materials.wood, 0, 1.9, .6, 3.9, .07, .07)
      break
    }
    case 'school': {
      pavilion(g, 4, 1.4, '义学')
      for (let i = 0; i < 4; i++) box(g, materials.wood, (i % 2) * 1 - .5, .45, Math.floor(i / 2) * .9 - .45, .7, .08, .4)
      break
    }
    case 'treasury': {
      for (let i = 0; i < 1 + more; i++) { const x = (i % 3) * .9 - .9, z = Math.floor(i / 3) * .8; box(g, materials.red, x, .3, z, .75, .55, .5); box(g, materials.gold, x, .58, z, .78, .06, .53); box(g, materials.gold, x, .35, z + .26, .12, .16, .02) }
      for (let i = 0; i < 3; i++) mesh(g, new T.TorusGeometry(.16, .05, 5, 10), materials.gold, -1.6 + i * .25, .06, .9).rotation.x = Math.PI / 2
      break
    }
    case 'kitchen': {
      mesh(g, cylinder, materials.stone, 0, .35, 0, .85, .7, .85)
      mesh(g, new T.CylinderGeometry(.75, .55, .6, 14), materials.dark, 0, .95, 0)
      mesh(g, disc, tint('#d9cfb4'), 0, 1.22, 0, .68, .68, .68).rotation.x = -Math.PI / 2
      puffs(g, 0, 1.6, 0, 4, new T.MeshStandardMaterial({ color: '#ece8de', transparent: true, opacity: .4, depthWrite: false }))
      box(g, materials.wood, 1.7, .6, 0, 1.4, .08, .7)
      for (let i = 0; i < 4; i++) mesh(g, cylinder, tint('#cdbf9d'), 1.2 + i * .33, .7, 0, .12, .1, .12)
      break
    }
    case 'aid': {
      for (let i = 0; i < 1 + more; i++) mesh(g, sphere, title === '药材' ? tint('#7f8a58') : straw, (i % 3) * .5 - .3, .3 + Math.floor(i / 3) * .45, (i % 2) * .3, .3, .32, .3)
      mesh(g, cylinder, materials.wood, -.8, .9, 0, .04, 1.8, .04)
      const lamp = mesh(g, new T.CylinderGeometry(.18, .22, .38, 8), lanternGlow, -.8, 1.6, .12); lamp.castShadow = false
      break
    }
    case 'pavilion': {
      pavilion(g, 6, 1.5, '议')
      box(g, materials.wood, 0, .6, 0, 1.2, .08, .7)
      break
    }
    case 'protest': {
      for (let i = 0; i < 3; i++) { mesh(g, cylinder, materials.wood, i * .9 - .9, 1, 0, .04, 2, .04); plaque(g, ['冤', '粮', '民'][i], i * .9 - .9, 1.9, .05, .55, { background: '#e9dcbd', size: 100 }) }
      break
    }
    case 'stele': {
      box(g, materials.stone, 0, .25, 0, 1.4, .5, .9)
      box(g, materials.stone, 0, 1.6, 0, 1, 2.3, .28)
      box(g, materials.roof, 0, 2.85, 0, 1.25, .2, .45)
      plaque(g, title, 0, 1.6, .15, 2, { vertical: true, color: '#e8dcc0', background: '#5f655d', size: 72 })
      break
    }
  }
  g.traverse(o => { if (o instanceof T.Mesh && !o.userData.puff && !o.userData.flicker) { o.castShadow = true; o.receiveShadow = true } })
  return g
}
