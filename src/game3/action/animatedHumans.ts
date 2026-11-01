import * as T from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { type ActorRig, keepShared } from './models3d'
import { dressHuman, type WarriorRole } from './humanEquipment'

let template: GLTF | undefined
let request: Promise<boolean> | undefined
const outfits = new Map<string, T.Group>()
export const humansReady = () => Boolean(template)
export function loadHumans(): Promise<boolean> {
  request ??= new GLTFLoader().loadAsync('arts/v3-models/warrior-base.glb').then(asset => {
    template = asset
    asset.scene.traverse(object => {
      if (!(object instanceof T.Mesh)) return
      keepShared(object.geometry)
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        keepShared(material)
        const map = (material as T.MeshStandardMaterial).map; if (map) keepShared(map)
      }
    })
    return true
  }).catch(() => false)
  return request
}

export type HumanPose = { moving: boolean; attacking: number; combo?: number; guard?: boolean; hit?: number; dash?: boolean; windup?: number; dead?: boolean; battle?: boolean }
export class HumanAnimation {
  private mixer: T.AnimationMixer
  private actions = new Map<string, T.AnimationAction>()
  private active = ''
  private previousAttack = 0
  private previousHit = 0
  private previousWindup = 0
  private combo = 0
  private transient = 0
  private clothTime = 0
  private bowBase = new Map<T.Object3D, T.Quaternion>()
  constructor(private scene: T.Group, private role: WarriorRole) {
    this.mixer = new T.AnimationMixer(scene)
    for (const clip of template!.animations) this.actions.set(clip.name, this.mixer.clipAction(clip))
    this.play('Sword_Idle', false)
    this.mixer.update(.1); scene.updateMatrixWorld(true)
  }
  private play(name: string, once: boolean, speed = 1, fade = .10) {
    const action = this.actions.get(name)
    if (!action) return
    if (this.active === name && !once) return
    const previous = this.actions.get(this.active)
    action.reset().setEffectiveTimeScale(speed).setEffectiveWeight(1).setLoop(once ? T.LoopOnce : T.LoopRepeat, once ? 1 : Infinity)
    action.paused = false
    action.clampWhenFinished = once; action.play()
    if (previous && previous !== action) previous.crossFadeTo(action, fade, false)
    this.active = name
  }
  update(pose: HumanPose, dt: number) {
    // Frozen frames must not accumulate the additive bow pose or change actions.
    if (dt <= 0) return
    for (const [bone, rotation] of this.bowBase) bone.quaternion.copy(rotation)
    this.bowBase.clear()
    this.transient = Math.max(0, this.transient - dt)
    if (pose.dead) { if (this.active !== 'Death01') this.play('Death01', true); this.mixer.update(dt); return }
    if (pose.dash) { if (this.active !== 'Roll') { this.play('Roll', true, 2.5, .045); this.transient = .45 } }
    else if ((pose.hit ?? 0) > this.previousHit + .05) { this.play('Hit_Chest', true, 1.2, .04); this.transient = .20 }
    else if (this.role !== 'player' && this.role !== 'archer' && (pose.windup ?? 0) > this.previousWindup + .05) {
      // Begin the authored anticipation before contact, including the enemy's
      // longer warning. Do not restart the clip when damage is then applied.
      const clip = this.role === 'brute' ? 'Sword_Attack' : 'Punch_Cross'
      this.play(clip, true, (this.role === 'brute' ? .7 : .36) / pose.windup!, .05)
      this.transient = pose.windup! + .25
    }
    else if (this.role === 'player' && (pose.attacking > this.previousAttack + .05 || (pose.attacking > 0 && pose.combo !== undefined && pose.combo !== this.combo))) {
      const index = pose.combo ?? 1
      this.play(['Sword_Regular_A', 'Sword_Regular_B', 'Sword_Regular_C'][(index - 1) % 3], true, index === 3 ? 2.8 : 1, .05)
      this.transient = index === 3 ? .65 : .42
    } else if (!this.transient) {
      if (pose.guard) { this.play('Sword_Block', false); const guard = this.actions.get('Sword_Block')!; guard.time = .4; guard.paused = true }
      else if (pose.moving) this.play(pose.battle ? 'Jog_Fwd_Loop' : 'Walk_Loop', false, pose.battle ? 1.1 : 1.25)
      else this.play(pose.battle ? 'Sword_Idle' : 'Idle_Loop', false)
    }
    this.mixer.update(dt)
    // Bow aiming layers onto the same articulated body; these packs have no bow clip.
    if (this.role === 'archer' && !pose.dead && !(pose.hit && pose.hit > 0)) {
      const left = this.scene.getObjectByName('upperarm_l')!, right = this.scene.getObjectByName('upperarm_r')!
      const forearm = this.scene.getObjectByName('lowerarm_r')!
      for (const bone of [left, right, forearm]) this.bowBase.set(bone, bone.quaternion.clone())
      left.rotateZ(-.5); right.rotateZ(.45)
      if (pose.windup) forearm.rotateX(-.9)
    }
    const cape = this.scene.getObjectByName('war-cape') as T.Mesh | undefined
    if (cape) {
      // Follow the shoulders, but let gravity keep the fabric hanging down when
      // the torso leans. Inheriting the chest rotation makes it look like a board.
      this.scene.updateMatrixWorld(true)
      this.scene.getObjectByName('war-cape-anchor')!.getWorldPosition(cape.position)
      this.scene.worldToLocal(cape.position); cape.position.y -= .45
      this.clothTime += dt
      const points = cape.geometry.attributes.position
      for (let i = 0; i < points.count; i++) {
        const drop = .5 - points.getY(i) / .9
        points.setZ(i, -.08 * drop - Math.sin(this.clothTime * (pose.moving ? 9 : 3) + drop * 4 + points.getX(i) * 6) * drop * (pose.moving ? .13 : .035))
      }
      points.needsUpdate = true; cape.geometry.computeVertexNormals()
    }
    this.previousAttack = pose.attacking; this.previousHit = pose.hit ?? 0; this.previousWindup = pose.windup ?? 0; this.combo = pose.combo ?? 0
  }
  dispose() { this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.scene) }
}

export function makeHuman(role: WarriorRole, tint: string): ActorRig {
  const key = `${role}:${tint}`
  let outfit = outfits.get(key)
  if (!outfit) {
    outfit = clone(template!.scene) as T.Group; outfit.updateMatrixWorld(true)
    dressHuman(outfit, role, tint).name = 'war-weapon'
    outfit.scale.setScalar(role === 'brute' ? 1.30 : 1.23)
    outfit.traverse(object => {
      if (!(object instanceof T.Mesh)) return
      keepShared(object.geometry)
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) keepShared(material)
    })
    outfits.set(key, outfit)
  }
  const root = new T.Group(), model = clone(outfit) as T.Group
  root.add(model); model.updateMatrixWorld(true)
  const weapon = model.getObjectByName('war-weapon') as T.Group
  model.traverse(object => { if (object instanceof T.Mesh) { object.castShadow = object.receiveShadow = true; object.frustumCulled = false } })
  const unused = () => new T.Group()
  const cape = new T.Mesh(new T.PlaneGeometry(.58, .9, 8, 12), new T.MeshStandardMaterial({ color: '#8b302b', roughness: .94, side: T.DoubleSide }))
  if (role === 'player') {
    const anchor = new T.Object3D(); anchor.name = 'war-cape-anchor'; anchor.position.set(0, 1.52, -.225)
    model.add(anchor); model.updateMatrixWorld(true); model.getObjectByName('spine_03')!.attach(anchor)
    cape.name = 'war-cape'; cape.position.set(0, 1.07, -.225); cape.castShadow = cape.receiveShadow = true
    model.add(cape)
  } else { cape.visible = false; root.add(cape) }
  const human = new HumanAnimation(model, role)
  const hand = model.getObjectByName('hand_r')!, inverseHand = hand.getWorldQuaternion(new T.Quaternion()).invert()
  const direction = new T.Vector3(0, role === 'player' ? .75 : .12, 1).normalize().applyQuaternion(inverseHand)
  weapon.quaternion.setFromUnitVectors(new T.Vector3(0, 0, -1), direction)
  const left = model.getObjectByName('hand_l')!, inverseLeft = left.getWorldQuaternion(new T.Quaternion()).invert()
  const shield = model.getObjectByName('war-shield'); shield?.quaternion.copy(inverseLeft)
  const bow = model.getObjectByName('war-bow'); bow?.quaternion.copy(inverseLeft)
  return { root, body: model, leftLeg: unused(), rightLeg: unused(), leftArm: unused(), rightArm: unused(), cape, sword: weapon, human }
}
