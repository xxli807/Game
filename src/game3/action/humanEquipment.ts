import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

export type WarriorRole = 'player' | 'soldier' | 'archer' | 'brute'

// Original Chinese-inspired clothing and equipment, fitted to the imported body's
// bind pose. Bone.attach preserves that fit when the authored animations play.
export function dressHuman(scene: T.Group, role: WarriorRole, color: string) {
  const cloth = new T.MeshStandardMaterial({ color, roughness: .94 })
  const leather = new T.MeshStandardMaterial({ color: '#30271f', roughness: .9 })
  const iron = new T.MeshStandardMaterial({ color: '#485050', metalness: .8, roughness: .42 })
  const edge = new T.MeshStandardMaterial({ color: '#92978c', metalness: .75, roughness: .3 })
  const bronze = new T.MeshStandardMaterial({ color: '#a48247', metalness: .7, roughness: .4 })
  const red = new T.MeshStandardMaterial({ color: '#75352c', roughness: .9, side: T.DoubleSide })
  const wood = new T.MeshStandardMaterial({ color: '#6a462b', roughness: .8 })
  const bone = (name: string) => scene.getObjectByName(name)!
  const attachments = new Map<string, T.Group>()
  const group = (name: string) => { let g = attachments.get(name); if (!g) { g = new T.Group(); scene.add(g); attachments.set(name, g) }; return g }
  const mesh = (parent: T.Object3D, geometry: T.BufferGeometry, material: T.Material, x: number, y: number, z: number) => {
    const m = new T.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m
  }
  const box = (g: T.Object3D, mat: T.Material, x: number, y: number, z: number, w: number, h: number, d: number) => mesh(g, new T.BoxGeometry(w, h, d), mat, x, y, z)
  const chest = group('spine_03'), waist = group('pelvis'), head = group('Head')
  // Continuous sleeves/trousers follow the actual skinned body, not rigid tubes.
  scene.traverse(object => {
    if (!(object instanceof T.SkinnedMesh) || object.name !== 'SuperHero_Male') return
    const geometry = object.geometry.clone(), positions = geometry.attributes.position, indices = geometry.index!
    const buckets: number[][] = [[], [], []]
    for (let i = 0; i < indices.count; i += 3) {
      const tri = [indices.getX(i), indices.getX(i + 1), indices.getX(i + 2)]
      const y = tri.reduce((s, j) => s + positions.getY(j), 0) / 3, x = tri.reduce((s, j) => s + Math.abs(positions.getX(j)), 0) / 3
      const material = y > 1.59 || (x > .75 && y > 1.3) ? 0 : y < .32 ? 2 : 1
      buckets[material].push(...tri)
    }
    geometry.setIndex(buckets.flat()); geometry.clearGroups()
    let offset = 0; buckets.forEach((values, material) => { geometry.addGroup(offset, values.length, material); offset += values.length })
    object.geometry = geometry; object.material = [object.material as T.Material, cloth, leather]
  })
  for (const side of [-1, 1]) for (let row = 0; row < 7; row++) for (let col = 0; col < 8; col++) {
    const x = (col - 3.5) * .052, y = 1.15 + row * .053, z = side * (.145 + .03 * (1 - (x / .23) ** 2))
    box(chest, iron, x, y, z, .047, .065, .018)
    box(chest, bronze, x, y + .017, z + side * .012, .012, .007, .006)
  }
  box(waist, leather, 0, 1.02, 0, .40, .075, .29); box(waist, bronze, 0, 1.02, .154, .085, .065, .015)
  const robe = mesh(waist, new T.CylinderGeometry(.19, .255, .30, 16, 1, true), cloth, 0, .84, 0); robe.scale.z = .78
  for (const side of [-1, 1]) for (let row = 0; row < 4; row++) for (let col = -2; col <= 2; col++) {
    box(waist, iron, col * .077, .92 - row * .057, side * .184, .069, .062, .019)
  }
  const helmet = mesh(head, new T.SphereGeometry(.119, 24, 16, 0, Math.PI * 2, 0, Math.PI * .57), iron, 0, 1.745, -.01)
  helmet.scale.set(1.04, 1.2, 1.12)
  mesh(head, new T.CylinderGeometry(.123, .121, .025, 24), bronze, 0, 1.745, -.01)
  box(head, iron, 0, 1.66, -.117, .20, .16, .025)
  for (const side of [-1, 1]) box(head, iron, side * .107, 1.69, -.025, .025, .14, .135)
  mesh(head, new T.ConeGeometry(.028, .12, 10), bronze, 0, 1.93, -.01)
  if (role === 'player') {
    const plume = mesh(head, new T.ConeGeometry(.032, .25, 12), red, 0, 2.06, -.025); plume.rotation.x = -.35
    const scarf = mesh(chest, new T.CylinderGeometry(.09, .12, .085, 16), red, 0, 1.52, -.006); scarf.scale.z = .85
  }
  for (const side of ['l', 'r']) {
    const shoulder = bone(`upperarm_${side}`).getWorldPosition(new T.Vector3())
    const forearm = bone(`lowerarm_${side}`).getWorldPosition(new T.Vector3())
    const shin = bone(`calf_${side}`).getWorldPosition(new T.Vector3())
    const pad = mesh(group(`upperarm_${side}`), new T.SphereGeometry(.125, 16, 10, 0, Math.PI * 2, 0, Math.PI * .7), iron, shoulder.x, shoulder.y + .015, shoulder.z)
    pad.scale.set(1.3, .7, 1.1)
    const bracer = mesh(group(`lowerarm_${side}`), new T.CylinderGeometry(.052, .06, .17, 12), leather, forearm.x + Math.sign(forearm.x) * .12, forearm.y, forearm.z)
    bracer.rotation.z = Math.PI / 2
    box(group(`calf_${side}`), iron, shin.x, shin.y - .13, shin.z + .055, .095, .25, .026)
  }
  if (role === 'archer') {
    mesh(chest, new T.CylinderGeometry(.06, .075, .48, 12), leather, .18, 1.22, -.21).rotation.z = -.2
    for (let i = 0; i < 5; i++) {
      mesh(chest, new T.CylinderGeometry(.006, .006, .60, 5), wood, .12 + i * .024, 1.42, -.21)
      box(chest, edge, .12 + i * .024, 1.70, -.21, .028, .07, .006)
    }
  }
  // Skin all fitted armour to the same skeleton and batch across bones by material.
  // This keeps an army's draw calls bounded instead of one draw per plate/limb.
  const body = scene.getObjectByName('SuperHero_Male') as T.SkinnedMesh
  const batches = new Map<T.Material, T.BufferGeometry[]>()
  for (const [name, g] of attachments) {
    const joint = body.skeleton.bones.indexOf(bone(name) as T.Bone)
    for (const child of [...g.children]) if (child instanceof T.Mesh) {
      child.updateMatrix(); const geometry = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone()
      geometry.applyMatrix4(child.matrix)
      const count = geometry.attributes.position.count, joints = new Uint16Array(count * 4), weights = new Float32Array(count * 4)
      for (let i = 0; i < count; i++) { joints[i * 4] = joint; weights[i * 4] = 1 }
      geometry.setAttribute('skinIndex', new T.BufferAttribute(joints, 4)); geometry.setAttribute('skinWeight', new T.BufferAttribute(weights, 4))
      const list = batches.get(child.material as T.Material) ?? []; list.push(geometry); batches.set(child.material as T.Material, list)
      g.remove(child); child.geometry.dispose()
    }
    scene.remove(g)
  }
  const armourParts: T.BufferGeometry[] = [], armourMaterials: T.Material[] = []
  for (const [mat, parts] of batches) {
    const combined = mergeGeometries(parts); parts.forEach(p => p.dispose())
    if (combined) { armourParts.push(combined); armourMaterials.push(mat) }
  }
  const armour = new T.SkinnedMesh(mergeGeometries(armourParts, true)!, armourMaterials)
  armourParts.forEach(part => part.dispose()); armour.bind(body.skeleton, body.bindMatrix); armour.name = 'war-armour'; scene.add(armour)
  const weapon = new T.Group(); bone('hand_r').add(weapon); weapon.position.set(0, .07, -.015)
  // Weapon points along local -Z; the authored grips close around its handle.
  if (role === 'player') {
    box(weapon, leather, 0, 0, 0, .05, .05, .19); box(weapon, bronze, 0, 0, -.11, .15, .045, .045)
    const shape = new T.Shape(); shape.moveTo(-.025, 0); shape.lineTo(-.025, .61); shape.quadraticCurveTo(.02, .81, .10, .9); shape.lineTo(.07, .08); shape.lineTo(.025, 0)
    mesh(weapon, new T.ExtrudeGeometry(shape, { depth: .013, bevelEnabled: true, bevelThickness: .005, bevelSize: .005, bevelSegments: 1 }), edge, 0, 0, -.13).rotation.x = -Math.PI / 2
  } else if (role !== 'archer') {
    mesh(weapon, new T.CylinderGeometry(.019, .022, 1.95, 8), wood, 0, 0, -.55).rotation.x = Math.PI / 2
    mesh(weapon, new T.ConeGeometry(.057, .26, 4), edge, 0, 0, -1.63).rotation.x = -Math.PI / 2
    if (role === 'brute') box(weapon, edge, .11, 0, -1.38, .22, .022, .27)
    if (role === 'soldier') {
      const shield = new T.Group(); shield.name = 'war-shield'; bone('hand_l').add(shield); shield.position.set(0, .05, .07)
      box(shield, leather, 0, 0, 0, .34, .57, .04); box(shield, cloth, 0, 0, .025, .30, .52, .015)
      for (const x of [-.16, .16]) box(shield, bronze, x, 0, .04, .016, .55, .014)
      box(shield, iron, 0, 0, .04, .037, .52, .026)
    }
  } else {
    weapon.visible = false
    const bow = new T.Group(); bow.name = 'war-bow'; bone('hand_l').add(bow); bow.position.set(0, .08, 0)
    const points = [-1, -.7, -.3, 0, .3, .7, 1].map(k => new T.Vector3(0, k * .48, .14 * (1 - k * k) - Math.abs(k) ** 4 * .07))
    mesh(bow, new T.TubeGeometry(new T.CatmullRomCurve3(points), 20, .019, 6, false), wood, 0, 0, 0)
    box(bow, leather, 0, 0, -.055, .005, .96, .005)
  }
  return weapon
}
