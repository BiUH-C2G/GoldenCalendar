const WASHOKU_COLORS = ['#9e3d3f', '#ec6d71', '#d0576b', '#f4b3c2', '#bc64a4', '#9d5b8b', '#895b8a', '#915c8b', '#4c6cb3', '#1e50a2', '#2792c3', '#2a83a2', '#008899', '#00a3af', '#38b48b', '#00a381', '#007b43', '#839b5c', '#98d98e', '#aacf53', '#d7cf3a', '#d0af4c', '#e6b422', '#c89932', '#bf783a', '#ee7948', '#cd5e3c', '#b55233', '#96514d', '#95483f', '#80aba9', '#bbbcde']

const WAGARA_PATTERNS = [
  { name: '青海波', size: '48px 24px', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="24" viewBox="0 0 48 24"><g fill="none" stroke="#000" stroke-width="1.2"><path d="M-12 24a12 12 0 0 1 24 0M-8 24a8 8 0 0 1 16 0M-4 24a4 4 0 0 1 8 0M12 24a12 12 0 0 1 24 0M16 24a8 8 0 0 1 16 0M20 24a4 4 0 0 1 8 0M36 24a12 12 0 0 1 24 0M40 24a8 8 0 0 1 16 0M44 24a4 4 0 0 1 8 0M0 12a12 12 0 0 1 24 0M4 12a8 8 0 0 1 16 0M8 12a4 4 0 0 1 8 0M24 12a12 12 0 0 1 24 0M28 12a8 8 0 0 1 16 0M32 12a4 4 0 0 1 8 0"/></g></svg>' },
  { name: '立涌', size: '36px 56px', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="56" viewBox="0 0 36 56"><g fill="none" stroke="#000" stroke-width="1.3"><path d="M9-8C24 2 24 14 9 24S-6 46 9 64M27-8C12 2 12 14 27 24s15 22 0 40M13-8C26 2 26 14 13 24S0 46 13 64M23-8C10 2 10 14 23 24s13 22 0 40"/></g></svg>' },
  { name: '七宝', size: '40px 40px', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><g fill="none" stroke="#000" stroke-width="1.15"><circle cx="0" cy="0" r="14"/><circle cx="40" cy="0" r="14"/><circle cx="0" cy="40" r="14"/><circle cx="40" cy="40" r="14"/><circle cx="20" cy="20" r="14"/></g></svg>' },
  { name: '亀甲', size: '48px 42px', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="42" viewBox="0 0 48 42"><g fill="none" stroke="#000" stroke-width="1.15"><path d="M12 0h24l12 21-12 21H12L0 21zM-12 0h24l12 21-12 21h-24L-24 21zM36 0h24l12 21-12 21H36L24 21z"/></g></svg>' },
  { name: '籠目', size: '42px 36px', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="42" height="36" viewBox="0 0 42 36"><g fill="none" stroke="#000" stroke-width="1"><path d="M0 36L21 0l21 36M0 0l21 36L42 0M-21 18h84M-10.5 18L10.5-18M10.5 54L31.5 18M31.5 18L52.5-18"/></g></svg>' },
  { name: '三崩し', size: '48px 48px', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g stroke="#000" stroke-width="1.5"><path d="M0 8h18M0 12h18M0 16h18M30 32h18M30 36h18M30 40h18M32 0v18M36 0v18M40 0v18M8 30v18M12 30v18M16 30v18"/></g></svg>' },
  { name: '紗綾形', size: '48px 48px', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g fill="none" stroke="#000" stroke-width="1.25"><path d="M0 8h16v8H8v16h8v8H0M48 8H32v8h8v16h-8v8h16M8 0v16h8V8h16v8h8V0M8 48V32h8v8h16v-8h8v16"/></g></svg>' },
  { name: '菱', size: '40px 28px', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="28" viewBox="0 0 40 28"><g fill="none" stroke="#000" stroke-width="1.1"><path d="M0 14L20 0l20 14-20 14zM-20 14L0 0l20 14L0 28zM20 14L40 0l20 14-20 14z"/></g></svg>' },
  { name: '鱗', size: '36px 31px', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="31" viewBox="0 0 36 31"><g fill="none" stroke="#000" stroke-width="1.1"><path d="M0 31L18 0l18 31zM-18 0L0 31l18-31M18 31L36 0l18 31"/></g></svg>' },
  { name: '市松', size: '32px 32px', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M0 0h16v16H0zM16 16h16v16H16z" fill="#000"/></svg>' },
  { name: '麻の葉', size: '48px 48px', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g fill="none" stroke="#000" stroke-width="1"><path d="M24 0v48M0 24h48M0 0l48 48M48 0L0 48M24 0L12 24l12 24 12-24zM0 24l24-12 24 12-24 12z"/></g></svg>' },
  { name: '格子', size: '36px 36px', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><g stroke="#000"><path d="M6 0v36M30 0v36M0 6h36M0 30h36" stroke-width="1.2"/><path d="M12 0v36M24 0v36M0 12h36M0 24h36" stroke-width=".55"/></g></svg>' }
]

const visualCache = new Map<string, Record<string, string>>()

function normalizeCourseKey(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g, ' ')
}

function stableHash(value: string, seed: number) {
  let hash = seed >>> 0
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619) >>> 0
  return hash
}

function svgMaskUrl(svg: string) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

export function getCourseVisual(title: string) {
  const key = normalizeCourseKey(title)
  const cached = visualCache.get(key)
  if (cached) return cached
  const color = WASHOKU_COLORS[stableHash(key, 2166136261) % WASHOKU_COLORS.length]
  const pattern = WAGARA_PATTERNS[stableHash(`纹样\u0000${key}`, 2246822519) % WAGARA_PATTERNS.length]
  const visual = { '--course-base': color, '--pattern-mask': svgMaskUrl(pattern.svg), '--pattern-size': pattern.size }
  visualCache.set(key, visual)
  return visual
}
