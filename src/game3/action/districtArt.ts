import * as T from 'three'
import type { Building } from './layout'
import { UNIT } from './layout'
import { box, glyphs, materials, mesh, mergeStatic, straw } from './models3d'

// Four small generated albedo maps are applied to real geometry. Kept per renderer
// so leaving a game can release them without affecting the next game's materials.
export function loadVillageSurfaces(anisotropy: number) {
  const loader = new T.TextureLoader()
  const surface = (name: string, color: string, roughness: number, bumpScale: number) => {
    const map = loader.load(`arts/v3-ui/${name}-v1.jpg`)
    map.colorSpace = T.SRGBColorSpace; map.wrapS = map.wrapT = T.RepeatWrapping
    map.anisotropy = Math.min(8, anisotropy)
    // Small height variation only; this albedo is not a dedicated normal map.
    return new T.MeshStandardMaterial({ map, bumpMap: map, bumpScale, color, roughness })
  }
  const roof = surface('tiles', '#b6c3c6', .9, .035); roof.side = T.DoubleSide
  return {
    ...materials,
    stone: surface('stone', '#d0cec4', 1, .035),
    wood: surface('timber', '#cebea4', .92, .018),
    plaster: surface('plaster', '#eee2c8', .98, .012),
    roof,
  }
}

// These props stay inside existing building footprints. They communicate the
// district's purpose without creating decorative obstacles on playable roads.
export function makeDistrictDetails(b: Building, surfaces: typeof materials) {
  const root = new T.Group(), w = b.width / UNIT, d = b.depth / UNIT
  const cylinder = new T.CylinderGeometry(1, 1, 1, 10)
  const ball = new T.SphereGeometry(1, 10, 8)
  const pot = (x: number, z: number, s = 1) => {
    mesh(root, new T.CylinderGeometry(.24, .34, .62, 10), materials.red, x, .67, z, s, s, s)
    mesh(root, cylinder, materials.dark, x, .985, z, .21 * s, .03, .21 * s)
  }
  if (b.kind === 'gate') {
    // Paired racks and shields identify a defended military gate at a glance.
    for (const side of [-1, 1]) {
      const x = side * w * .34, z = d / 2 - .04
      box(root, surfaces.wood, x, 1.2, z, 1.8, .14, .2)
      for (const offset of [-.7, .7]) box(root, surfaces.wood, x + offset, .85, z, .1, 1.35, .12)
      for (let i = 0; i < 4; i++) {
        const p = x - .6 + i * .4
        mesh(root, cylinder, materials.wood, p, 1.25, z + .15, .03, 2, .03)
        mesh(root, new T.ConeGeometry(.1, .38, 4), materials.edge, p, 2.4, z + .15)
      }
      const shield = mesh(root, new T.CylinderGeometry(.38, .38, .12, 10), materials.red, x, .88, z + .22)
      shield.rotation.x = Math.PI / 2
      const boss = mesh(root, ball, materials.gold, x, .88, z + .31, .12, .12, .055)
      boss.castShadow = false
    }
  } else if (b.kind === 'granary') {
    // Loading platforms and bound sacks distinguish food stores from a house.
    for (const side of [-1, 1]) {
      const x = side * w * .34, z = d / 2 - .02
      box(root, surfaces.wood, x, .5, z, 2, .22, .75)
      for (let i = 0; i < 6; i++) {
        const px = x - .65 + i % 3 * .65, py = .92 + Math.floor(i / 3) * .55
        mesh(root, ball, straw, px, py, z, .33, .34, .29)
        mesh(root, cylinder, materials.wood, px, py + .31, z, .06, .09, .06)
      }
    }
  } else if (b.kind === 'hall') {
    const x = -w * .35, z = d / 2 - .08
    box(root, surfaces.wood, x, 1.55, z, 1.7, 1.55, .15)
    for (const offset of [-.6, .6]) box(root, surfaces.wood, x + offset, .8, z, .13, 1.55, .13)
    // Actual calligraphy on a physical noticeboard, not a floating quest panel.
    const notice = new T.Mesh(new T.PlaneGeometry(1.35, .95), new T.MeshStandardMaterial({ map: glyphs(b.y < 300 ? '安民告示' : '里坊公议', { color: '#443622', background: '#dbc9a3', size: 64 }).texture, roughness: 1 }))
    notice.position.set(x, 1.6, z + .09); root.add(notice)
    pot(w * .36, d / 2 - .1)
  } else if (b.kind === 'house') {
    pot(-w * .35, d / 2 - .02, .8)
    for (let i = 0; i < 5; i++) {
      const log = mesh(root, cylinder, surfaces.wood, w * .34 + i % 2 * .13, .45 + Math.floor(i / 2) * .14, d / 2 - .14, .08, .72, .08)
      log.rotation.x = Math.PI / 2
    }
    box(root, surfaces.wood, w * .3, 1.52, d / 2 - .3, .8, .05, .55)
  } else {
    // Bronze offering bowls belong to the dynasty's ritual space.
    for (const side of [-1, 1]) {
      mesh(root, new T.CylinderGeometry(.5, .25, .22, 12), materials.gold, side * 2, .56, 1.6)
      for (let i = 0; i < 3; i++) mesh(root, cylinder, materials.red, side * 2 + (i - 1) * .12, .95, 1.6, .016, .75, .016)
    }
  }
  // Cache nothing globally: merged geometry is owned by this renderer.
  const merged = mergeStatic(root)
  cylinder.dispose(); ball.dispose()
  return merged
}

export function makeCarriedSupplies() {
  const root = new T.Group()
  const parcel = new T.Group(), scroll = new T.Group(), medicine = new T.Group()
  mesh(parcel, new T.SphereGeometry(1, 10, 8), straw, 0, 0, 0, .34, .28, .25)
  box(parcel, materials.wood, 0, 0, .245, .045, .48, .015)
  for (const x of [-.2, .2]) {
    const roll = mesh(scroll, new T.CylinderGeometry(.07, .07, .6, 8), straw, x, 0, 0)
    roll.rotation.z = Math.PI / 2
  }
  box(medicine, materials.red, 0, 0, 0, .5, .32, .28)
  box(medicine, materials.gold, 0, 0, .145, .04, .29, .01)
  root.add(parcel, scroll, medicine); root.position.set(0, 1.16, .45)
  return { root, parcel, scroll, medicine }
}
