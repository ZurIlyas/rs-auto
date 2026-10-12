// 3D-сцена первого экрана: Porsche 911 в студии. Машина поворачивается по прокрутке,
// её можно крутить мышью или пальцем и перекрашивать.
// Модель: «(FREE) Porsche 911 Carrera 4S», автор Karol Miklas, лицензия CC BY-SA 4.0.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

export type Car = {
  /** прогресс прокрутки первого экрана, 0..1 */
  setProgress(p: number): void
  setPaint(hex: string): void
}

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const smooth = (t: number) => t * t * (3 - 2 * t)

// Студия для отражений: тёмная комната с длинными софтбоксами. Из неё делается карта окружения,
// поэтому на кузове видны полосы света, как на съёмке в автосалоне.
function studio(renderer: THREE.WebGLRenderer) {
  const env = new THREE.Scene()
  env.background = new THREE.Color(0x050507)
  const box = (w: number, h: number, color: number, k: number, pos: [number, number, number], rot: [number, number, number]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }))
    m.position.set(...pos)
    m.rotation.set(...rot)
    env.add(m)
  }
  for (let i = -2; i <= 2; i++) box(1.6, 14, 0xffffff, 3.2, [i * 3.4, 7, 0], [Math.PI / 2, 0, 0])      // потолочные полосы
  box(18, 3, 0xffe2a8, 2.2, [-9, 2.5, 0], [0, Math.PI / 2, 0])                                         // тёплая стена слева
  box(18, 1.2, 0xffffff, 3, [9, 1.6, 0], [0, -Math.PI / 2, 0])                                         // узкая белая справа
  box(10, 4, 0xd6a23f, 1.6, [0, 3, -10], [0, 0, 0])                                                    // золотой задник
  box(6, 2, 0xffffff, 1.4, [0, 2, 10], [0, Math.PI, 0])
  const pmrem = new THREE.PMREMGenerator(renderer)
  const tex = pmrem.fromScene(env, 0.035).texture
  pmrem.dispose()
  return tex
}

// мягкая тень под машиной
function shadowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(128, 128, 10, 128, 128, 128)
  grad.addColorStop(0, 'rgba(0,0,0,.85)')
  grad.addColorStop(0.55, 'rgba(0,0,0,.45)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 256)
  return new THREE.CanvasTexture(c)
}

export function initCar(canvas: HTMLCanvasElement, onLoad: (ratio: number) => void): Car | null {
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  } catch {
    return null
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05

  const scene = new THREE.Scene()
  scene.environment = studio(renderer)
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100)

  const key = new THREE.DirectionalLight(0xfff2dc, 1.6)
  key.position.set(4, 7, 5)
  scene.add(key)
  const rim = new THREE.PointLight(0xd6a23f, 60, 30)
  rim.position.set(-5, 2.5, -5)
  scene.add(rim)

  const rig = new THREE.Group()     // поворот по прокрутке и мышью
  scene.add(rig)

  // подиум: тёмный диск, золотое кольцо, тень
  const disc = new THREE.Mesh(new THREE.CircleGeometry(3.5, 96), new THREE.MeshStandardMaterial({ color: 0x141318, roughness: 0.5, metalness: 0.45, envMapIntensity: 0.55 }))
  disc.rotation.x = -Math.PI / 2
  rig.add(disc)
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.5, 3.55, 128), new THREE.MeshBasicMaterial({ color: 0xd6a23f }))
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.002
  rig.add(ring)
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(2.75, 2.762, 128), new THREE.MeshBasicMaterial({ color: 0xd6a23f, transparent: true, opacity: 0.35 }))
  ring2.rotation.x = -Math.PI / 2
  ring2.position.y = 0.003
  rig.add(ring2)
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 3.6), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }))
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.006
  rig.add(shadow)

  let paint: THREE.MeshPhysicalMaterial | null = null
  const paintTarget = new THREE.Color(0xe0aa3e)

  const draco = new DRACOLoader().setDecoderPath('./draco/')
  new GLTFLoader().setDRACOLoader(draco).load(
    './assets/911.glb',
    (gltf) => {
      const car = gltf.scene
      const mats = new Map<string, THREE.Material>()
      car.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined
        if (m && !Array.isArray(m)) mats.set(m.name, m)
      })
      const tune = (name: string, props: Record<string, unknown>) => {
        const m = mats.get(name) as (THREE.MeshPhysicalMaterial & Record<string, unknown>) | undefined
        if (!m) return
        for (const [k, v] of Object.entries(props)) {
          if (k === 'color') m.color.set(v as THREE.ColorRepresentation)
          else m[k] = v
        }
        m.needsUpdate = true
      }
      tune('rubber', { color: '#1c1c1e', roughness: 0.62, roughnessMap: null })
      tune('window', { color: '#000000', roughness: 0, clearcoat: 0.1 })
      tune('coat', { envMapIntensity: 3, roughness: 0.5, metalness: 1 })
      tune('paint', { envMapIntensity: 1.5, roughness: 0.3, metalness: 0.72, clearcoat: 1, clearcoatRoughness: 0.06 })
      paint = (mats.get('paint') as THREE.MeshPhysicalMaterial) ?? null
      paint?.color.copy(paintTarget)

      // ставим машину в центр подиума, колёсами на пол, длиной 4.5
      const box = new THREE.Box3().setFromObject(car)
      const size = box.getSize(new THREE.Vector3())
      const k = 4.5 / Math.max(size.x, size.z)
      car.scale.setScalar(k)
      box.setFromObject(car)
      const c = box.getCenter(new THREE.Vector3())
      car.position.x -= c.x
      car.position.z -= c.z
      car.position.y -= box.min.y
      // длинной стороной вдоль X, чтобы углы поворота не зависели от исходной ориентации модели
      if (size.z > size.x) { const g = new THREE.Group(); g.add(car); g.rotation.y = Math.PI / 2; rig.add(g) } else rig.add(car)
      onLoad(1)
      kick()
    },
    (e) => onLoad(e.total ? Math.min(e.loaded / e.total, 0.99) : 0.5),
    () => onLoad(-1),
  )

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }

  let target = 0, cur = 0, drag = 0, dragV = 0, raf = 0, last = performance.now(), idle = 0
  function draw() {
    const p = cur, wide = camera.aspect > 1.15
    // три ракурса: спереди в три четверти → сбоку → сзади в три четверти
    rig.rotation.y = -0.72 + smooth(p) * 3.5 + drag + Math.sin(idle * 0.35) * 0.035
    // на широком экране расстояние постоянное, на узком — такое, чтобы машина помещалась по ширине
    const r = (wide ? 13.4 : 5.4 / (0.4618 * camera.aspect)) - Math.sin(p * Math.PI) * 0.8
    const elev = 0.2 + Math.sin(p * Math.PI) * 0.13
    // на широком экране машина справа от текста, на узком — по центру
    const shift = wide ? -r * 0.165 : 0
    camera.position.set(shift, 0.75 + r * Math.sin(elev), r * Math.cos(elev))
    camera.lookAt(shift, wide ? 0.55 : -0.2, 0)
    if (paint && !paint.color.equals(paintTarget)) paint.color.lerp(paintTarget, 0.08)
    renderer.render(scene, camera)
  }
  function loop(now: number) {
    raf = 0
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    idle += dt
    cur += (target - cur) * 0.1
    drag += dragV
    dragV *= 0.92
    draw()
    if (visible) raf = requestAnimationFrame(loop)
  }
  function kick() {
    if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(loop) }
  }

  // рисуем только пока первый экран виден
  let visible = true
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick() }).observe(canvas)

  // вращение мышью и пальцем: по горизонтали крутим, вертикаль оставляем прокрутке страницы
  let down = false, px = 0
  canvas.addEventListener('pointerdown', (e) => { down = true; px = e.clientX; canvas.setPointerCapture(e.pointerId) })
  canvas.addEventListener('pointermove', (e) => {
    if (!down) return
    dragV = (e.clientX - px) * 0.0016
    drag += (e.clientX - px) * 0.006
    px = e.clientX
  })
  const up = () => { down = false }
  canvas.addEventListener('pointerup', up)
  canvas.addEventListener('pointercancel', up)

  new ResizeObserver(() => { resize(); draw() }).observe(canvas)
  resize()
  kick()

  return {
    setProgress(p) { target = clamp(p) },
    setPaint(hex) { paintTarget.set(hex) },
  }
}
