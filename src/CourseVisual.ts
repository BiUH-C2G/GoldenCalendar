export interface WashokuColor {
  id: string
  name: string
  hex: string
}

export interface WagaraPattern {
  id: string
  name: string
  size: string
  svg: string
}

export interface CourseVisual {
  color: WashokuColor
  pattern: WagaraPattern
  style: Record<string, string>
}

export const WASHOKU_COLORS: WashokuColor[] = [
  { id: 'suou', name: '蘇芳', hex: '#9e3d3f' },
  { id: 'masoo', name: '真朱', hex: '#ec6d71' },
  { id: 'imayou', name: '今様色', hex: '#d0576b' },
  { id: 'toki', name: '鴇色', hex: '#f4b3c2' },
  { id: 'wakamurasaki', name: '若紫', hex: '#bc64a4' },
  { id: 'kyoumurasaki', name: '京紫', hex: '#9d5b8b' },
  { id: 'kodaimurasaki', name: '古代紫', hex: '#895b8a' },
  { id: 'futaai', name: '二藍', hex: '#915c8b' },
  { id: 'gunjou', name: '群青色', hex: '#4c6cb3' },
  { id: 'ruri', name: '瑠璃色', hex: '#1e50a2' },
  { id: 'hanada', name: '縹色', hex: '#2792c3' },
  { id: 'hanaasagi', name: '花浅葱', hex: '#2a83a2' },
  { id: 'nando', name: '納戸色', hex: '#008899' },
  { id: 'asagi', name: '浅葱色', hex: '#00a3af' },
  { id: 'hisui', name: '翡翠色', hex: '#38b48b' },
  { id: 'hanarokushou', name: '花緑青', hex: '#00a381' },
  { id: 'tokiwa', name: '常磐色', hex: '#007b43' },
  { id: 'matsuba', name: '松葉色', hex: '#839b5c' },
  { id: 'wakamidori', name: '若緑', hex: '#98d98e' },
  { id: 'moegi', name: '萌黄', hex: '#aacf53' },
  { id: 'hiwa', name: '鶸色', hex: '#d7cf3a' },
  { id: 'karashi', name: '芥子色', hex: '#d0af4c' },
  { id: 'kogane', name: '黄金', hex: '#e6b422' },
  { id: 'yamabukicha', name: '山吹茶', hex: '#c89932' },
  { id: 'kohaku', name: '琥珀色', hex: '#bf783a' },
  { id: 'ouni', name: '黄丹', hex: '#ee7948' },
  { id: 'kaba', name: '樺色', hex: '#cd5e3c' },
  { id: 'renga', name: '煉瓦色', hex: '#b55233' },
  { id: 'azuki', name: '小豆色', hex: '#96514d' },
  { id: 'tobi', name: '鳶色', hex: '#95483f' },
  { id: 'mizuasagi', name: '水浅葱', hex: '#80aba9' },
  { id: 'fuji', name: '藤色', hex: '#bbbcde' }
]

export const WAGARA_PATTERNS: WagaraPattern[] = [
  { id: 'seigaiha', name: '青海波', size: '48px 24px', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="24" viewBox="0 0 48 24"><g fill="none" stroke="#000" stroke-width="1.2"><path d="M-12 24a12 12 0 0 1 24 0M-8 24a8 8 0 0 1 16 0M-4 24a4 4 0 0 1 8 0"/><path d="M12 24a12 12 0 0 1 24 0M16 24a8 8 0 0 1 16 0M20 24a4 4 0 0 1 8 0"/><path d="M36 24a12 12 0 0 1 24 0M40 24a8 8 0 0 1 16 0M44 24a4 4 0 0 1 8 0"/><path d="M0 12a12 12 0 0 1 24 0M4 12a8 8 0 0 1 16 0M8 12a4 4 0 0 1 8 0M24 12a12 12 0 0 1 24 0M28 12a8 8 0 0 1 16 0M32 12a4 4 0 0 1 8 0"/></g></svg>' },
  { id: 'tachiwaki', name: '立涌', size: '36px 56px', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="56" viewBox="0 0 36 56"><g fill="none" stroke="#000" stroke-width="1.3"><path d="M9-8C24 2 24 14 9 24S-6 46 9 64M27-8C12 2 12 14 27 24s15 22 0 40"/><path d="M13-8C26 2 26 14 13 24S0 46 13 64M23-8C10 2 10 14 23 24s13 22 0 40"/></g></svg>' },
  { id: 'shippo', name: '七宝', size: '40px 40px', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><g fill="none" stroke="#000" stroke-width="1.15"><circle cx="0" cy="0" r="14"/><circle cx="40" cy="0" r="14"/><circle cx="0" cy="40" r="14"/><circle cx="40" cy="40" r="14"/><circle cx="20" cy="20" r="14"/></g></svg>' },
  { id: 'fundotsunagi', name: '分銅繋ぎ', size: '48px 48px', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g fill="none" stroke="#000" stroke-width="1.2"><path d="M0 12h10l7 7 7-7 7 7 7-7h10M0 36h10l7-7 7 7 7-7 7 7h10"/><path d="M17 19c-5 0-9 4-9 5s4 5 9 5M31 19c5 0 9 4 9 5s-4 5-9 5"/></g></svg>' },
  { id: 'amime', name: '網目', size: '32px 44px', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 32 44"><g fill="none" stroke="#000" stroke-width="1"><path d="M-16 22L0 0l16 22L32 0l16 22M-16 22L0 44l16-22 16 22 16-22"/></g></svg>' },
  { id: 'kikko', name: '亀甲', size: '48px 42px', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="42" viewBox="0 0 48 42"><g fill="none" stroke="#000" stroke-width="1.15"><path d="M12 0h24l12 21-12 21H12L0 21z"/><path d="M-12 0h24l12 21-12 21h-24L-24 21zM36 0h24l12 21-12 21H36L24 21z"/></g></svg>' },
  { id: 'kagome', name: '籠目', size: '42px 36px', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="42" height="36" viewBox="0 0 42 36"><g fill="none" stroke="#000" stroke-width="1"><path d="M0 36L21 0l21 36M0 0l21 36L42 0M-21 18h84"/><path d="M-10.5 18L10.5-18M10.5 54L31.5 18M31.5 18L52.5-18"/></g></svg>' },
  { id: 'mitsukuzushi', name: '三崩し', size: '48px 48px', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g stroke="#000" stroke-width="1.5"><path d="M0 8h18M0 12h18M0 16h18M30 32h18M30 36h18M30 40h18"/><path d="M32 0v18M36 0v18M40 0v18M8 30v18M12 30v18M16 30v18"/></g></svg>' },
  { id: 'higaki', name: '檜垣', size: '48px 48px', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g fill="none" stroke="#000" stroke-width="1.3"><path d="M-8 8L8 24-8 40M8-8l16 16L8 24l16 16L8 56M24-8l16 16L24 24l16 16L24 56M40-8L56 8 40 24l16 16"/><path d="M0 0l16 16M16 0l16 16M32 0l16 16M0 32l16 16M16 32l16 16M32 32l16 16"/></g></svg>' },
  { id: 'sayagata', name: '紗綾形', size: '48px 48px', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g fill="none" stroke="#000" stroke-width="1.25" stroke-linejoin="miter"><path d="M0 8h16v8H8v16h8v8H0M48 8H32v8h8v16h-8v8h16M8 0v16h8V8h16v8h8V0M8 48V32h8v8h16v-8h8v16"/></g></svg>' },
  { id: 'shokko', name: '蜀江', size: '56px 56px', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56"><g fill="none" stroke="#000" stroke-width="1"><path d="M14 0h28l14 14v28L42 56H14L0 42V14z"/><path d="M28 7l21 21-21 21L7 28z"/><path d="M0 28h56M28 0v56"/></g></svg>' },
  { id: 'koji', name: '工字繋ぎ', size: '48px 48px', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g fill="none" stroke="#000" stroke-width="1.25"><path d="M0 8h16v8H8v16h8v8H0M48 8H32v8h8v16h-8v8h16"/><path d="M16 0v16h16V0M16 48V32h16v16"/></g></svg>' },
  { id: 'sawtooth', name: '鋸歯', size: '40px 24px', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="24" viewBox="0 0 40 24"><g fill="none" stroke="#000" stroke-width="1.2"><path d="M-10 18L0 6l10 12L20 6l10 12L40 6l10 12"/><path d="M-10 23L0 11l10 12 10-12 10 12 10-12 10 12"/></g></svg>' },
  { id: 'hishi', name: '菱', size: '40px 28px', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="28" viewBox="0 0 40 28"><g fill="none" stroke="#000" stroke-width="1.1"><path d="M0 14L20 0l20 14-20 14zM-20 14L0 0l20 14L0 28zM20 14L40 0l20 14-20 14z"/></g></svg>' },
  { id: 'uroko', name: '鱗', size: '36px 31px', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="31" viewBox="0 0 36 31"><g fill="none" stroke="#000" stroke-width="1.1"><path d="M0 31L18 0l18 31zM-18 0L0 31l18-31M18 31L36 0l18 31"/></g></svg>' },
  { id: 'ichimatsu', name: '石畳・市松', size: '32px 32px', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M0 0h16v16H0zM16 16h16v16H16z" fill="#000"/></svg>' },
  { id: 'asanoha', name: '麻の葉', size: '48px 48px', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g fill="none" stroke="#000" stroke-width="1"><path d="M24 0v48M0 24h48M0 0l48 48M48 0L0 48"/><path d="M24 0L12 24l12 24 12-24zM0 24l24-12 24 12-24 12z"/></g></svg>' },
  { id: 'shima', name: '縞', size: '28px 28px', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><g stroke="#000"><path d="M4 0v28M8 0v28" stroke-width="1"/><path d="M18 0v28" stroke-width="2"/><path d="M24 0v28" stroke-width=".8"/></g></svg>' },
  { id: 'koshi', name: '格子', size: '36px 36px', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><g stroke="#000"><path d="M6 0v36M30 0v36M0 6h36M0 30h36" stroke-width="1.2"/><path d="M12 0v36M24 0v36M0 12h36M0 24h36" stroke-width=".55"/></g></svg>' }
]

const visualCache = new Map<string, CourseVisual>()

function normalizeCourseKey(value: string) {
  return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ')
}

function rotateLeft(value: number, bits: number) {
  return ((value << bits) | (value >>> (32 - bits))) >>> 0
}

function sha1Bytes(text: string) {
  const input = new TextEncoder().encode(text)
  const bitLength = input.length * 8
  const paddedLength = ((input.length + 9 + 63) >> 6) << 6
  const buffer = new Uint8Array(paddedLength)
  buffer.set(input)
  buffer[input.length] = 0x80

  const view = new DataView(buffer.buffer)
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false)
  view.setUint32(paddedLength - 4, bitLength >>> 0, false)

  let h0 = 0x67452301
  let h1 = 0xefcdab89
  let h2 = 0x98badcfe
  let h3 = 0x10325476
  let h4 = 0xc3d2e1f0
  const words = new Uint32Array(80)

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, false)
    for (let index = 16; index < 80; index += 1) words[index] = rotateLeft(words[index - 3] ^ words[index - 8] ^ words[index - 14] ^ words[index - 16], 1)

    let a = h0
    let b = h1
    let c = h2
    let d = h3
    let e = h4

    for (let index = 0; index < 80; index += 1) {
      let f: number
      let k: number

      if (index < 20) {
        f = (b & c) | (~b & d)
        k = 0x5a827999
      } else if (index < 40) {
        f = b ^ c ^ d
        k = 0x6ed9eba1
      } else if (index < 60) {
        f = (b & c) | (b & d) | (c & d)
        k = 0x8f1bbcdc
      } else {
        f = b ^ c ^ d
        k = 0xca62c1d6
      }

      const next = (rotateLeft(a, 5) + f + e + k + words[index]) >>> 0
      e = d
      d = c
      c = rotateLeft(b, 30)
      b = a
      a = next
    }

    h0 = (h0 + a) >>> 0
    h1 = (h1 + b) >>> 0
    h2 = (h2 + c) >>> 0
    h3 = (h3 + d) >>> 0
    h4 = (h4 + e) >>> 0
  }

  const digest = new Uint8Array(20)
  const digestView = new DataView(digest.buffer)
  const hashes = [h0, h1, h2, h3, h4]
  hashes.forEach((value, index) => digestView.setUint32(index * 4, value, false))
  return digest
}

function digestIndex(digest: Uint8Array, length: number) {
  const value = new DataView(digest.buffer, digest.byteOffset, digest.byteLength).getUint32(0, false)
  return Math.floor(value * length / 0x100000000)
}

function svgMaskUrl(svg: string) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

export function getCourseVisual(title: string) {
  const key = normalizeCourseKey(title)
  const cached = visualCache.get(key)
  if (cached) return cached

  const color = WASHOKU_COLORS[digestIndex(sha1Bytes(`颜色\u0000${key}`), WASHOKU_COLORS.length)]
  const pattern = WAGARA_PATTERNS[digestIndex(sha1Bytes(`纹理\u0000${key}`), WAGARA_PATTERNS.length)]
  const style = { '--course-base': color.hex, '--pattern-mask': svgMaskUrl(pattern.svg), '--pattern-size': pattern.size }
  const visual = { color, pattern, style }
  visualCache.set(key, visual)
  return visual
}
