import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { type ActorRig } from './models3d'
import { humansReady, makeHuman } from './animatedHumans'

export function makeArrowGeometry() {
  const parts = [
    new T.CylinderGeometry(.012, .012, 1.05, 5).rotateX(Math.PI / 2),
    new T.ConeGeometry(.045, .15, 4).rotateX(Math.PI / 2).translate(0, 0, .58),
    new T.BoxGeometry(.10, .008, .18).translate(0, 0, -.43),
    new T.BoxGeometry(.008, .10, .18).translate(0, 0, -.43),
  ].map(g => { const flat = g.toNonIndexed(); g.dispose(); return flat })
  const geometry = mergeGeometries(parts)!; parts.forEach(p => p.dispose()); return geometry
}

// Original, articulated battlefield models. The equipment is a broad historical
// interpretation, not a reconstruction of one dynasty's uniform.
export function makeWarrior(role: 'player' | 'soldier' | 'archer' | 'brute', color = '#405c58'): ActorRig {
  if (humansReady()) return makeHuman(role, color)
  const root = new T.Group(), body = new T.Group(); root.add(body)
  const cloth = new T.MeshStandardMaterial({ color, roughness: .96 })
  const iron = new T.MeshStandardMaterial({ color: '#424c4b', roughness: .48, metalness: .72 })
  const edge = new T.MeshStandardMaterial({ color: '#949787', roughness: .4, metalness: .65 })
  const leather = new T.MeshStandardMaterial({ color: '#392c23', roughness: .95 })
  const wood = new T.MeshStandardMaterial({ color: '#795335', roughness: .88 })
  const skin = new T.MeshStandardMaterial({ color: '#b69070', roughness: .9 })
  const bronze = new T.MeshStandardMaterial({ color: '#b29252', metalness: .65, roughness: .44 })
  const red = new T.MeshStandardMaterial({ color: '#7b3026', roughness: .95, side: T.DoubleSide })
  const add = (parent: T.Object3D, geo: T.BufferGeometry, mat: T.Material, x: number, y: number, z: number) => {
    const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m
  }
  const box = (p: T.Object3D, m: T.Material, x: number, y: number, z: number, w: number, h: number, d: number) => add(p, new T.BoxGeometry(w, h, d), m, x, y, z)
  const ellipsoid = (p: T.Object3D, m: T.Material, x: number, y: number, z: number, w: number, h: number, d: number) => {
    const mesh = add(p, new T.SphereGeometry(1, 16, 12), m, x, y, z); mesh.scale.set(w, h, d); return mesh
  }
  const tube = (p: T.Object3D, m: T.Material, points: T.Vector3[], radius: number) => add(p, new T.TubeGeometry(new T.CatmullRomCurve3(points), 16, radius, 5, false), m, 0, 0, 0)
  const torso = add(body, new T.CylinderGeometry(.285, .24, .69, 12), cloth, 0, 1.43, 0); torso.scale.z = .65
  add(body, new T.CylinderGeometry(.23, .32, .43, 12), cloth, 0, .98, 0).scale.z = .7
  // Many overlapping plates are merged into a few material batches, not separate draw calls.
  for (const side of [-1, 1]) for (let row = 0; row < 6; row++) for (let col = 0; col < 7; col++) {
    const x = (col - 3) * .072, y = 1.2 + row * .082, z = side * (.175 + .034 * (1 - (x / .27) ** 2))
    box(body, iron, x, y, z, .065, .095, .024)
    if (row % 2 === 0) box(body, leather, x, y + .03, z + side * .016, .026, .012, .012)
  }
  for (let side = -1; side <= 1; side++) for (let row = 0; row < 3; row++) {
    box(body, iron, side * .17, .93 - row * .085, .205, .145, .095, .034)
    box(body, edge, side * .17, .90 - row * .085, .225, .13, .013, .012)
  }
  box(body, leather, 0, 1.15, 0, .53, .11, .41)
  box(body, bronze, .035, 1.15, .222, .115, .09, .025)
  // Small head, neck, cheek and nape guards instead of the old oversized round head.
  add(body, new T.CylinderGeometry(.075, .085, .12, 10), skin, 0, 1.81, 0)
  ellipsoid(body, skin, 0, 1.98, .015, .135, .185, .13)
  ellipsoid(body, skin, 0, 1.95, .14, .026, .043, .035)
  for (const side of [-1, 1]) {
    box(body, leather, side * .054, 2.01, .13, .034, .011, .012)
    const cheek = box(body, iron, side * .139, 1.94, -.025, .033, .19, .15); cheek.rotation.z = side * .15
  }
  add(body, new T.SphereGeometry(.153, 16, 10, 0, Math.PI * 2, 0, Math.PI * .54), iron, 0, 2.065, -.012)
  add(body, new T.CylinderGeometry(.153, .151, .037, 16), bronze, 0, 2.065, -.012)
  box(body, iron, 0, 1.93, -.15, .26, .25, .036)
  add(body, new T.ConeGeometry(.042, .17, 8), bronze, 0, 2.27, -.012)
  if (role === 'player' || role === 'brute') {
    tube(body, red, [new T.Vector3(0, 2.31, 0), new T.Vector3(0, 2.43, -.1), new T.Vector3(0, 2.32, -.31)], .045)
  }
  const knees: T.Group[] = [], elbows: T.Group[] = []
  const legs = [-1, 1].map(side => {
    const hip = new T.Group(); hip.position.set(side * .135, 1.04, 0); body.add(hip)
    add(hip, new T.CylinderGeometry(.105, .085, .44, 10), cloth, 0, -.22, 0)
    const knee = new T.Group(); knee.position.y = -.44; hip.add(knee); knees.push(knee)
    add(knee, new T.CylinderGeometry(.086, .06, .43, 10), leather, 0, -.215, 0)
    box(knee, iron, 0, -.16, .07, .11, .28, .035)
    ellipsoid(knee, leather, 0, -.48, .07, .092, .08, .17)
    return hip
  })
  const arms = [-1, 1].map(side => {
    const shoulder = new T.Group(); shoulder.position.set(side * .31, 1.68, 0); body.add(shoulder)
    add(shoulder, new T.CylinderGeometry(.095, .075, .32, 10), cloth, 0, -.16, 0)
    for (let i = 0; i < 3; i++) box(shoulder, iron, side * .018, -.02 - i * .056, 0, .205 - i * .014, .065, .28)
    const elbow = new T.Group(); elbow.position.y = -.32; shoulder.add(elbow); elbows.push(elbow)
    add(elbow, new T.CylinderGeometry(.075, .053, .28, 10), leather, 0, -.14, 0)
    box(elbow, iron, 0, -.13, .058, .105, .20, .026)
    ellipsoid(elbow, skin, 0, -.30, .008, .058, .075, .054)
    return shoulder
  })
  const sword = new T.Group(); sword.position.set(0, -.30, .02); elbows[1].add(sword)
  if (role === 'soldier' || role === 'brute') {
    const shaft = add(sword, new T.CylinderGeometry(.022, .027, 2.35, 8), wood, 0, 0, .7); shaft.rotation.x = Math.PI / 2
    const point = add(sword, new T.ConeGeometry(.085, .36, 4), edge, 0, 0, 2.04); point.rotation.x = Math.PI / 2
    box(sword, red, 0, -.055, 1.82, .06, .14, .08)
    if (role === 'brute') {
      const blade = new T.Shape(); blade.moveTo(0, 0); blade.lineTo(.36, .1); blade.quadraticCurveTo(.48, .4, .15, .55); blade.lineTo(0, .45)
      const head = add(sword, new T.ExtrudeGeometry(blade, { depth: .035, bevelEnabled: false }), edge, 0, -.015, 1.52); head.rotation.x = Math.PI / 2
    } else {
      const shield = new T.Group(); shield.position.set(0, -.18, .14); elbows[0].add(shield)
      box(shield, leather, 0, 0, 0, .46, .76, .055)
      box(shield, cloth, 0, 0, .034, .41, .69, .016)
      for (const x of [-.215, .215]) box(shield, bronze, x, 0, .04, .024, .76, .022)
      for (const y of [-.36, .36]) box(shield, bronze, 0, y, .04, .43, .024, .022)
      box(shield, iron, 0, 0, .052, .06, .63, .028)
      ellipsoid(shield, bronze, 0, .02, .08, .073, .075, .035)
    }
  } else if (role === 'player') {
    box(sword, leather, 0, 0, .07, .065, .065, .25)
    box(sword, bronze, 0, 0, .21, .19, .04, .055)
    const blade = new T.Shape(); blade.moveTo(-.045, 0); blade.lineTo(-.045, .8); blade.quadraticCurveTo(-.025, 1.08, .13, 1.18); blade.lineTo(.095, .17); blade.lineTo(.05, 0)
    const saber = add(sword, new T.ExtrudeGeometry(blade, { depth: .024, bevelEnabled: true, bevelSize: .009, bevelThickness: .008, bevelSegments: 1 }), edge, 0, 0, .23); saber.rotation.x = Math.PI / 2
    box(body, leather, -.30, .99, -.06, .07, .78, .1).rotation.z = -.25
  } else {
    sword.visible = false
    const bow = new T.Group(); bow.position.set(0, -.29, .08); elbows[0].add(bow)
    const points = [-1, -.7, -.35, 0, .35, .7, 1].map(k => new T.Vector3(0, k * .61, .18 * (1 - k * k) - Math.abs(k) ** 4 * .08))
    tube(bow, wood, points, .024)
    tube(bow, leather, [new T.Vector3(0, -.61, -.08), new T.Vector3(0, 0, -.13), new T.Vector3(0, .61, -.08)], .006)
    add(body, new T.CylinderGeometry(.075, .09, .62, 10), leather, .20, 1.42, -.23).rotation.z = -.18
    for (let i = 0; i < 4; i++) {
      add(body, new T.CylinderGeometry(.009, .009, .73, 5), wood, .13 + i * .033, 1.65, -.235)
      box(body, edge, .13 + i * .033, 1.98, -.235, .04, .10, .007)
    }
  }
  const cape = new T.Mesh(new T.PlaneGeometry(.62, 1.0, 6, 8), red)
  cape.position.set(0, 1.2, -.25); cape.rotation.x = -.18; cape.castShadow = true; cape.visible = role === 'player'; body.add(cape)
  if (role === 'brute') root.scale.set(1.08, 1.06, 1.08)
  // Merge only direct static children, preserving every articulation pivot and cape.
  const bake = (group: T.Group) => {
    const batches = new Map<T.Material, T.Mesh[]>()
    for (const child of [...group.children]) {
      if (child instanceof T.Group) bake(child)
      else if (child instanceof T.Mesh && child !== cape) { const m = child.material as T.Material; const list = batches.get(m) ?? []; list.push(child); batches.set(m, list) }
    }
    for (const [material, list] of batches) {
      const geometries = list.map(m => { m.updateMatrix(); return (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix) })
      const merged = mergeGeometries(geometries)
      geometries.forEach(g => g.dispose())
      if (merged) { list.forEach(m => { group.remove(m); m.geometry.dispose() }); add(group, merged, material, 0, 0, 0) }
    }
  }
  bake(body)
  return { root, body, leftLeg: legs[0], rightLeg: legs[1], leftArm: arms[0], rightArm: arms[1], cape, sword, joints: { knees, elbows, role } }
}

export function poseWarrior(rig: ActorRig, windup: number, swing: number, hurt = 0, guarding = false, combo = 0) {
  if (!rig.joints || !rig.body) return
  const { elbows, role } = rig.joints
  rig.body.rotation.set(hurt > 0 ? -.16 : 0, 0, 0)
  rig.sword.position.z = .02
  if (role === 'archer') {
    rig.leftArm.rotation.x = -1.35; rig.leftArm.rotation.z = -.18; elbows[0].rotation.x = -.12
    rig.rightArm.rotation.x = windup > 0 ? -1.35 : -.75; rig.rightArm.rotation.z = windup > 0 ? .75 : .2
    elbows[1].rotation.x = windup > 0 ? -1.8 : -.6
  } else if (role === 'soldier' || role === 'brute') {
    rig.leftArm.rotation.x = -.3; elbows[0].rotation.x = -.55
    rig.rightArm.rotation.x = -.2; elbows[1].rotation.x = -.25
    if (windup > 0) { rig.body.rotation.y = -.22; rig.sword.position.z = -.3; rig.rightArm.rotation.x = .15 }
    if (swing > 0) { const thrust = Math.sin(Math.min(1, swing / .3) * Math.PI); rig.sword.position.z = .02 + thrust * .48; rig.body.rotation.x = thrust * .14; rig.rightArm.rotation.x = -.35 }
  } else {
    elbows[0].rotation.x = -.4; elbows[1].rotation.x = -.3
    if (guarding) { rig.rightArm.rotation.set(-1.2, 0, -.7); elbows[1].rotation.x = -1.1; rig.leftArm.rotation.x = -.9; rig.body.rotation.y = -.3 }
    else if (swing > 0) {
      const t = 1 - swing / .48, reverse = combo === 2 ? -1 : 1
      const stroke = t < .28 ? t / .28 * .2 : Math.min(1, (t - .28) / .45)
      rig.body.rotation.y = reverse * (-.45 + stroke * .95)
      rig.rightArm.rotation.set(-1.7 + stroke * 1.15, reverse * (-.7 + stroke * 1.5), -.4)
      elbows[1].rotation.x = -.65 + stroke * .5
      if (combo === 3) { rig.rightArm.rotation.x = -2.5 + stroke * 2.2; rig.body.rotation.x = stroke * .18 }
    }
  }
}
