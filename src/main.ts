import './style.css'
import { initCar } from './car'

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s)!
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => Array.from(r.querySelectorAll<T>(s))

const WHATSAPP = '79382029777'

// три ракурса машины — три услуги
const STAGES = [
  ['ТО', 'Плановое обслуживание по регламенту автомобиля.'],
  ['Ремонт после ДТП', 'Восстанавливаем автомобиль после аварии.'],
  ['Детейлинг', 'Приводим в порядок кузов и салон.'],
]

// ---------- первый экран ----------
const hero = $('[data-hero]'), loader = $('[data-loader]')
const car = initCar($<HTMLCanvasElement>('[data-car]'), (ratio) => {
  if (ratio < 0) { $('[data-loader-text]').textContent = 'Не удалось загрузить модель'; return }
  $('[data-loader-bar]').style.width = ratio * 100 + '%'
  if (ratio >= 1) loader.classList.add('done')
})
if (!car) loader.classList.add('done')

const forced = Number(new URLSearchParams(location.search).get('p')) || 0   // ?p=0.5 — посмотреть ракурс без прокрутки
let stage = -1
function onScroll() {
  $('.top').classList.toggle('solid', scrollY > 30)
  const r = hero.getBoundingClientRect(), span = r.height - innerHeight
  const p = forced || Math.max(0, Math.min(1, -r.top / (span || 1)))
  car?.setProgress(p)
  $('[data-bar]').style.width = p * 100 + '%'
  $('[data-hint]').style.opacity = p > 0.03 ? '0' : '1'
  const k = Math.min(2, Math.floor(p * 3))
  if (k !== stage) {
    stage = k
    $('[data-stage-n]').textContent = '0' + (k + 1)
    $('[data-stage-title]').textContent = STAGES[k][0]
    $('[data-stage-text]').textContent = STAGES[k][1]
    $$('[data-stage-dots] i').forEach((d, i) => d.classList.toggle('on', i <= k))
  }
}
addEventListener('scroll', onScroll, { passive: true })
addEventListener('resize', onScroll)
onScroll()

$$<HTMLButtonElement>('[data-paint]').forEach((b) =>
  b.addEventListener('click', () => {
    $$('[data-paint]').forEach((x) => x.classList.toggle('on', x === b))
    car?.setPaint(b.dataset.paint!)
  }),
)

// ---------- заявка ----------
const form = $<HTMLFormElement>('[data-form]')
// кнопка в карточке услуги сразу отмечает эту услугу в форме
$$('[data-pick]').forEach((el) =>
  el.addEventListener('click', () => {
    const input = $$<HTMLInputElement>('input[name=service]', form).find((i) => i.value === el.dataset.pick)
    if (input) input.checked = true
  }),
)
form.addEventListener('submit', (e) => {
  e.preventDefault()
  const d = new FormData(form)
  const carName = String(d.get('car') || '').trim(), note = String(d.get('note') || '').trim()
  const text = ['Здравствуйте! Заявка с сайта Repair Service.', 'Услуга: ' + d.get('service') + '.', carName && 'Автомобиль: ' + carName + '.', note && 'Комментарий: ' + note]
    .filter(Boolean)
    .join('\n')
  window.open('https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(text), '_blank', 'noopener')
})

const copy = $<HTMLButtonElement>('[data-copy]')
copy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(copy.dataset.copy!)
    copy.textContent = 'номер скопирован'
  } catch {
    copy.textContent = copy.dataset.copy!
  }
})

// ---------- появление блоков ----------
const io = new IntersectionObserver(
  (es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }),
  { rootMargin: '0px 0px -8% 0px' },
)
$$('.rv').forEach((el) => io.observe(el))
