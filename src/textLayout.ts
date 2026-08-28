import {
  measureNaturalWidth,
  prepareWithSegments,
  type PreparedTextWithSegments,
} from '@chenglou/pretext'

export type TextRole = 'title' | 'teacher' | 'room' | 'debug'

export interface TextLineStyle {
  text: string
  fontSize: number
  fontWeight: number
  absoluteWeight: number
  relativeWeight: number
  targetStroke: number
  strokeThickness: number
  letterSpacing: number
  scaleX: number
  naturalWidth: number
  fittedWidth: number
  hardBreak: boolean
  overflow: boolean
}

export interface ComfortZone {
  width: number
  contentWidth: number
  padding: number
  paddingThreshold: number
  paddingEligible: boolean
  minimum: number
  ideal: number
  maximum: number
  referenceWidth: number
}

export interface LayoutBreakdown {
  size: number
  lines: number
  balance: number
  weight: number
  readability: number
  naturalText: number
  transform: number
  breaks: number
  total: number
  penalties: LayoutPenalty[]
  linesDetail: LayoutLineScore[]
}

export interface LayoutPenalty {
  key: string
  label: string
  points: number
  reason: string
}

export interface LayoutLineScore {
  text: string
  characterCount: number
  balanceRatio: number
  absoluteWeight: number
  relativeWeight: number
  fontWeight: number
  targetStroke: number
  strokeThickness: number
  strokeRatio: number
  fontSizeDeficit: number
  compression: number
  expansion: number
  letterSpacing: number
  overflow: boolean
  penalties: LayoutPenalty[]
}

export interface LayoutCandidate {
  id: string
  source: 'normal' | 'hard-break'
  baseSize: number
  weightIterations: number
  lines: TextLineStyle[]
  score: number
  breakdown: LayoutBreakdown
}

export interface TextLayoutResult {
  text: string
  width: number
  fontFamily: string
  maxSize: number
  spacingCap: number
  role: TextRole
  viewportWidth: number
  comfort: ComfortZone
  effectiveComfort: ComfortZone
  selected: LayoutCandidate
  candidates: LayoutCandidate[]
  iterations: number
  cacheKey: string
}

export interface TextLayoutOptions {
  width: number
  text: string
  fontFamily?: string
  maxSize?: number
  spacingCap?: number
  role?: TextRole
  viewportWidth?: number
}

interface ResolvedTextLayoutOptions {
  width: number
  text: string
  fontFamily: string
  maxSize: number
  spacingCap: number
  role: TextRole
  viewportWidth?: number
}

export const SCHEDULE_FONT = {
  family: 'Source Han Sans SC VF',
  weightMin: 250,
  weightMax: 900,
  referenceWeight: 560,
  strokeSizeExponent: 0.52,
} as const

const STROKE_PROFILE = [
  { weight: 250, density: 0.48 },
  { weight: 350, density: 0.59 },
  { weight: 450, density: 0.70 },
  { weight: 550, density: 0.83 },
  { weight: 650, density: 0.97 },
  { weight: 750, density: 1.12 },
  { weight: 850, density: 1.27 },
  { weight: 900, density: 1.34 },
] as const

const SEARCH_FLOOR_SIZE = 1
const MIN_SCALE_X = 0.8
const HARD_FRAGMENT_MIN = 4
const MAX_CANDIDATES = 160
const SCORE_EPSILON = 0.0001
const cache = new Map<string, TextLayoutResult>()
const preparedCache = new Map<string, PreparedTextWithSegments>()
const measuredWidthCache = new Map<string, number>()
const PREPARED_CACHE_LIMIT = 2400
const MEASURED_WIDTH_CACHE_LIMIT = 6000

function fontFor(fontFamily: string, fontSize: number, fontWeight: number) {
  return `${fontWeight} ${fontSize}px ${fontFamily}`
}

function prepareText(text: string, fontFamily: string, fontSize: number, fontWeight: number, letterSpacing = 0) {
  const font = fontFor(fontFamily, fontSize, fontWeight)
  const cacheKey = [text, font, letterSpacing].join('::')
  const cached = preparedCache.get(cacheKey)
  if (cached) return cached
  const prepared = prepareWithSegments(text, font, {
    whiteSpace: 'pre-wrap',
    wordBreak: 'normal',
    letterSpacing,
  })
  preparedCache.set(cacheKey, prepared)
  if (preparedCache.size > PREPARED_CACHE_LIMIT) {
    preparedCache.delete(preparedCache.keys().next().value as string)
  }
  return prepared
}

function measure(text: string, fontFamily: string, fontSize: number, fontWeight: number, letterSpacing = 0) {
  const cacheKey = [text, fontFamily, fontSize, fontWeight, letterSpacing].join('::')
  const cached = measuredWidthCache.get(cacheKey)
  if (cached !== undefined) return cached
  const measuredWidth = measureNaturalWidth(prepareText(text, fontFamily, fontSize, fontWeight, letterSpacing))
  measuredWidthCache.set(cacheKey, measuredWidth)
  if (measuredWidthCache.size > MEASURED_WIDTH_CACHE_LIMIT) {
    measuredWidthCache.delete(measuredWidthCache.keys().next().value as string)
  }
  return measuredWidth
}

function densityForWeight(weight: number) {
  const boundedWeight = clamp(weight, SCHEDULE_FONT.weightMin, SCHEDULE_FONT.weightMax)
  for (let index = 1; index < STROKE_PROFILE.length; index++) {
    const upper = STROKE_PROFILE[index]!
    const lower = STROKE_PROFILE[index - 1]!
    if (boundedWeight <= upper.weight) {
      const progress = (boundedWeight - lower.weight) / (upper.weight - lower.weight)
      return lower.density + (upper.density - lower.density) * progress
    }
  }
  return STROKE_PROFILE[STROKE_PROFILE.length - 1]!.density
}

function weightForDensity(density: number) {
  const boundedDensity = clamp(
    density,
    STROKE_PROFILE[0]!.density,
    STROKE_PROFILE[STROKE_PROFILE.length - 1]!.density,
  )
  for (let index = 1; index < STROKE_PROFILE.length; index++) {
    const upper = STROKE_PROFILE[index]!
    const lower = STROKE_PROFILE[index - 1]!
    if (boundedDensity <= upper.density) {
      const progress = (boundedDensity - lower.density) / (upper.density - lower.density)
      return lower.weight + (upper.weight - lower.weight) * progress
    }
  }
  return STROKE_PROFILE[STROKE_PROFILE.length - 1]!.weight
}

function strokeThicknessFor(fontSize: number, fontWeight: number) {
  return Math.max(0, fontSize) * densityForWeight(fontWeight)
}

function targetStrokeForCluster(clusterSize: number, maxSize: number) {
  const referenceSize = Math.max(maxSize, SEARCH_FLOOR_SIZE)
  const referenceStroke = strokeThicknessFor(referenceSize, SCHEDULE_FONT.referenceWeight)
  return referenceStroke * (Math.max(clusterSize, SEARCH_FLOOR_SIZE) / referenceSize) ** SCHEDULE_FONT.strokeSizeExponent
}

function absoluteWeightFor(clusterSize: number, maxSize: number) {
  const targetStroke = targetStrokeForCluster(clusterSize, maxSize)
  return Math.round(weightForDensity(targetStroke / Math.max(clusterSize, SEARCH_FLOOR_SIZE)))
}

function weightProfileFor(fontSize: number, clusterSize: number, maxSize: number) {
  const targetStroke = targetStrokeForCluster(clusterSize, maxSize)
  const absoluteWeight = absoluteWeightFor(clusterSize, maxSize)
  const fontWeight = Math.round(weightForDensity(targetStroke / Math.max(fontSize, SEARCH_FLOOR_SIZE)))
  const relativeWeight = fontWeight - absoluteWeight
  return {
    absoluteWeight,
    relativeWeight,
    fontWeight: Math.round(clamp(fontWeight, SCHEDULE_FONT.weightMin, SCHEDULE_FONT.weightMax)),
    targetStroke,
  }
}

function weightFor(fontSize: number, maxSize: number) {
  return absoluteWeightFor(fontSize, maxSize)
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function splitWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean)
}

interface LayoutToken {
  text: string
  spaceBefore: boolean
  requiredBreakBefore?: boolean
}

interface WordVariant {
  segments: string[]
  score: number
}

function wordVariants(
  word: string,
  options: ResolvedTextLayoutOptions,
  baseSize: number,
  generationWeight = weightFor(baseSize, options.maxSize),
): WordVariant[] {
  const weight = generationWeight
  const lineLimit = options.width / MIN_SCALE_X
  const wordWidth = measure(word, options.fontFamily, baseSize, weight)
  if (wordWidth <= lineLimit) return []

  const characters = Array.from(word)
  const maxSegments = Math.min(
    Math.floor(characters.length / HARD_FRAGMENT_MIN),
    Math.max(2, Math.ceil(wordWidth / Math.max(lineLimit, 1)) + 1),
  )
  const variants: WordVariant[] = []

  function walk(start: number, parts: string[]) {
    if (variants.length >= 400) return
    if (start === characters.length) {
      if (parts.length < 2) return
      const widths = parts.map((part, index) => measure(
        index < parts.length - 1 ? `${part}-` : part,
        options.fontFamily,
        baseSize,
        weight,
      ))
      const mean = widths.reduce((sum, value) => sum + value, 0) / widths.length
      const imbalance = widths.reduce((sum, value) => sum + Math.abs(value - mean), 0) / Math.max(options.width, 1)
      variants.push({
        segments: parts,
        score: imbalance + (parts.length - 1) * 0.65,
      })
      return
    }
    if (parts.length >= maxSegments) return
    const remaining = characters.length - start
    const maxEnd = characters.length - (parts.length === maxSegments - 1 ? 0 : HARD_FRAGMENT_MIN)
    for (let end = start + HARD_FRAGMENT_MIN; end <= maxEnd; end++) {
      const remainingAfter = characters.length - end
      if (remainingAfter > 0 && remainingAfter < HARD_FRAGMENT_MIN) continue
      const part = characters.slice(start, end).join('')
      walk(end, [...parts, part])
    }
  }

  walk(0, [])
  return variants
    .sort((a, b) => a.score - b.score)
    .slice(0, 96)
}

function createTokenVariants(
  words: string[],
  options: ResolvedTextLayoutOptions,
  baseSize: number,
  generationWeight: number,
) {
  const variants: Array<{ tokens: LayoutToken[], source: 'normal' | 'hard-break' }> = [{ tokens: [], source: 'normal' }]
  words.forEach((word, wordIndex) => {
    const variantsForWord = wordVariants(word, options, baseSize, generationWeight)
    const choices: Array<{ segments: string[], hardBreak: boolean }> = [
      { segments: [word], hardBreak: false },
      ...variantsForWord.map((variant) => ({ segments: variant.segments, hardBreak: true })),
    ]
    const next: Array<{ tokens: LayoutToken[], source: 'normal' | 'hard-break' }> = []
    variants.forEach((prefix) => choices.forEach((choice) => {
      const tokens = choice.segments.map((text, segmentIndex) => ({
        // Keep the hyphen in the token so generation, fitting, scoring, and
        // rendering all measure the same visible text.
        text: choice.hardBreak && segmentIndex < choice.segments.length - 1 ? `${text}-` : text,
        spaceBefore: segmentIndex === 0 && wordIndex > 0,
        requiredBreakBefore: segmentIndex > 0,
      }))
      next.push({
        tokens: [...prefix.tokens, ...tokens],
        source: prefix.source === 'hard-break' || choice.hardBreak ? 'hard-break' : 'normal',
      })
    }))
    variants.splice(0, variants.length, ...next.slice(0, 160))
  })
  return variants
}

function generatePartitions(
  tokens: LayoutToken[],
  options: ResolvedTextLayoutOptions,
  baseSize: number,
  generationWeight: number,
  source: 'normal' | 'hard-break',
) {
  const result: Array<{ texts: string[], hardBreaks: boolean[] }> = []
  const lineLimit = options.width / MIN_SCALE_X
  const weight = generationWeight

  function walk(start: number, texts: string[], hardBreaks: boolean[]) {
    if (result.length >= MAX_CANDIDATES) return
    if (start >= tokens.length) {
      result.push({ texts, hardBreaks })
      return
    }
    let current = ''
    for (let end = start; end < tokens.length; end++) {
      const token = tokens[end]!
      if (end > start && token.requiredBreakBefore) break
      current = token.spaceBefore && current ? `${current} ${token.text}` : `${current}${token.text}`
      const currentWidth = measure(current, options.fontFamily, baseSize, weight)
      if (currentWidth > lineLimit && end > start) break
      if (currentWidth <= lineLimit || end === start) {
        const hardBreak = source === 'hard-break' && Boolean(tokens[end + 1]?.requiredBreakBefore)
        walk(end + 1, [...texts, current], [...hardBreaks, hardBreak])
      }
    }
  }

  walk(0, [], [])
  return result
}

function partitionText(
  text: string,
  options: ResolvedTextLayoutOptions,
  baseSize: number,
  generationWeight: number,
) {
  const paragraphs = text.split(/\r?\n/)
  let all: Array<{ texts: string[], hardBreaks: boolean[] }> = [{ texts: [], hardBreaks: [] }]
  paragraphs.forEach((paragraph, paragraphIndex) => {
    const words = splitWords(paragraph)
    if (!words.length) return
    const paragraphVariants = createTokenVariants(words, options, baseSize, generationWeight)
      .flatMap((variant) => generatePartitions(variant.tokens, options, baseSize, generationWeight, variant.source))
    all = all.flatMap((prefix) => paragraphVariants.map((candidate) => ({
      texts: [...prefix.texts, ...candidate.texts],
      hardBreaks: [...prefix.hardBreaks, ...candidate.hardBreaks],
    })))
    // Each paragraph is a hard line boundary. Keep its lines separate so
    // the renderer never has to interpret a newline inside a nowrap glyph.
  })
  return all.slice(0, MAX_CANDIDATES)
}

function deriveComfort(options: ResolvedTextLayoutOptions) {
  const referenceWeight = weightFor(options.maxSize, options.maxSize)
  const referenceWidth = Math.max(
    measure('1234567', options.fontFamily, options.maxSize, referenceWeight),
    options.maxSize * 3.5,
  )
  const viewportWidth = options.viewportWidth ?? (typeof window === 'undefined' ? 1200 : window.innerWidth)
  const paddingThreshold = clamp(viewportWidth * 0.18, 180, 280)
  const paddingEligible = options.width >= paddingThreshold
  const padding = paddingEligible ? clamp(options.width * 0.04, 8, 16) : 0
  const contentWidth = Math.max(1, options.width - padding * 2)
  const ideal = Math.max(SEARCH_FLOOR_SIZE, options.maxSize * Math.sqrt(contentWidth / referenceWidth) * 1.1)
  return {
    width: options.width,
    contentWidth,
    padding,
    paddingThreshold,
    paddingEligible,
    minimum: Math.max(SEARCH_FLOOR_SIZE, ideal * 0.8),
    ideal,
    maximum: Math.max(SEARCH_FLOOR_SIZE, ideal * 1.32),
    referenceWidth,
  } satisfies ComfortZone
}

function sizeCandidates(zone: ComfortZone, maxSize: number) {
  const low = Math.max(SEARCH_FLOOR_SIZE, zone.minimum * 0.62)
  const high = zone.paddingEligible
    ? Math.max(maxSize, zone.maximum * 1.15)
    : Math.max(maxSize, zone.ideal * 1.18)
  const values = [low, zone.minimum, zone.ideal, zone.maximum, maxSize, high]
  for (let index = 1; index <= 8; index++) values.push(low + (high - low) * index / 9)
  return [...new Set(values.map((value) => round(clamp(value, SEARCH_FLOOR_SIZE, high), 2)))].sort((a, b) => b - a)
}

function fitLine(
  text: string,
  options: ResolvedTextLayoutOptions,
  baseSize: number,
  averageSize: number,
  zone: ComfortZone,
  hardBreak: boolean,
) {
  const candidateSizes = [baseSize, zone.ideal, zone.minimum, zone.maximum]
  const lineReferenceWidth = Math.max(measure(text, options.fontFamily, options.maxSize, weightFor(options.maxSize, options.maxSize)), 1)
  const lineIdeal = options.maxSize * zone.contentWidth / lineReferenceWidth
  candidateSizes.push(lineIdeal)
  const upperSize = zone.paddingEligible ? zone.maximum : Math.max(zone.maximum, lineIdeal)
  const sizes = [...new Set(candidateSizes.map((size) => clamp(size, SEARCH_FLOOR_SIZE, upperSize)))]
  let best: TextLineStyle | null = null
  let bestScore = Number.NEGATIVE_INFINITY
  sizes.forEach((fontSize) => {
    const weightProfile = weightProfileFor(fontSize, averageSize, options.maxSize)
    const fontWeight = weightProfile.fontWeight
    const naturalWidth = measure(text, options.fontFamily, fontSize, fontWeight)
    const characterCount = Math.max(Array.from(text.replace(/\n/g, '')).length - 1, 1)
    const letterSpacing = clamp((zone.contentWidth - naturalWidth) / characterCount, 0, options.spacingCap)
    const fittedWidth = measure(text, options.fontFamily, fontSize, fontWeight, letterSpacing)
    const scaleX = zone.contentWidth / Math.max(fittedWidth, 1)
    if (scaleX < MIN_SCALE_X - SCORE_EPSILON) return
    const scalePenalty = Math.abs(Math.log(Math.max(scaleX, MIN_SCALE_X))) * 5
    const sizePenalty = Math.abs(Math.log(fontSize / Math.max(zone.ideal, 1))) * 1.5
    const score = -scalePenalty - sizePenalty - letterSpacing * 0.7
    if (score > bestScore) {
      bestScore = score
      best = {
        text,
        fontSize: round(fontSize),
        fontWeight,
        absoluteWeight: weightProfile.absoluteWeight,
        relativeWeight: weightProfile.relativeWeight,
        targetStroke: round(weightProfile.targetStroke),
        strokeThickness: round(strokeThicknessFor(fontSize, fontWeight)),
        letterSpacing: round(letterSpacing),
        scaleX: round(Math.max(MIN_SCALE_X, scaleX), 4),
        naturalWidth: round(naturalWidth),
        fittedWidth: round(fittedWidth),
        hardBreak,
        overflow: false,
      }
    }
  })
  if (best) return best
  const fallbackSize = Math.max(SEARCH_FLOOR_SIZE, Math.min(baseSize, zone.minimum))
  const fallbackProfile = weightProfileFor(fallbackSize, averageSize, options.maxSize)
  const fallbackWeight = fallbackProfile.fontWeight
  const fallbackWidth = measure(text, options.fontFamily, fallbackSize, fallbackWeight)
  return {
    text,
    fontSize: round(fallbackSize),
    fontWeight: fallbackWeight,
    absoluteWeight: fallbackProfile.absoluteWeight,
    relativeWeight: fallbackProfile.relativeWeight,
    targetStroke: round(fallbackProfile.targetStroke),
    strokeThickness: round(strokeThicknessFor(fallbackSize, fallbackWeight)),
    letterSpacing: 0,
    scaleX: MIN_SCALE_X,
    naturalWidth: round(fallbackWidth),
    fittedWidth: round(fallbackWidth),
    hardBreak,
    overflow: fallbackWidth > options.width / MIN_SCALE_X,
  } satisfies TextLineStyle
}

function fitCandidateLines(
  texts: string[],
  options: ResolvedTextLayoutOptions,
  baseSize: number,
  zone: ComfortZone,
  hardBreaks: boolean[],
) {
  let averageSize = baseSize
  let lines: TextLineStyle[] = []
  let iterations = 0

  for (let iteration = 0; iteration < 4; iteration++) {
    lines = texts.map((text, index) => fitLine(
      text,
      options,
      baseSize,
      averageSize,
      zone,
      hardBreaks[index] ?? false,
    ))
    const nextAverageSize = lines.reduce((sum, line) => sum + line.fontSize, 0) / Math.max(lines.length, 1)
    iterations = iteration + 1
    if (Math.abs(nextAverageSize - averageSize) < 0.05) break
    averageSize = nextAverageSize
  }

  return { lines, iterations }
}

function scoreCandidate(lines: TextLineStyle[], baseSize: number, zone: ComfortZone, source: 'normal' | 'hard-break') {
  const visibleLines = lines.map((line) => line.text.replace(/\n/g, '').trim()).filter(Boolean)
  const charCounts = visibleLines.map((line) => Array.from(line.replace(/[- ]/g, '')).length)
  const meanChars = charCounts.reduce((sum, count) => sum + count, 0) / Math.max(charCounts.length, 1)
  const visualUnits = lines.map((line) => line.naturalWidth / Math.max(line.fontSize, 1))
  const meanVisualUnits = visualUnits.reduce((sum, value) => sum + value, 0) / Math.max(visualUnits.length, 1)
  const lineBalanceValues = charCounts.map((count, index) => (
    (count / Math.max(meanChars, 1)) * 0.62
    + (visualUnits[index]! / Math.max(meanVisualUnits, 1)) * 0.38
  ))
  const lineSpread = lineBalanceValues.length > 1
    ? Math.max(...lineBalanceValues) - Math.min(...lineBalanceValues)
    : 0
  const lineVariance = lineBalanceValues.reduce((sum, value) => sum + (value - 1) ** 2, 0)
    / Math.max(lineBalanceValues.length, 1)
  const shortLinePenalty = charCounts.reduce((sum, count, index) => {
    if (charCounts.length === 1) return sum
    const ratio = count / Math.max(meanChars, 1)
    if (count <= 2) return sum + 34
    if (index < charCounts.length - 1 && ratio < 0.56) return sum + (0.56 - ratio) ** 2 * 42
    if (index === charCounts.length - 1 && ratio < 0.3) return sum + (0.3 - ratio) ** 2 * 10
    return sum
  }, 0)
  const balancePenalty = lineSpread ** 2 * 18 + lineVariance * 10
  const linePenalty = Math.max(0, lines.length - 1) * 1.1
  const hardBreakCount = lines.filter((line) => line.hardBreak).length
  const hardBreakPenalty = hardBreakCount * 2.4
  const numericOrSymbolPenalty = lines.reduce((sum, line, index) => {
    const value = line.text.trim()
    if (index === lines.length - 1) return sum
    return sum + (/^\d+$/.test(value) || /^[&+\-−]$/.test(value) ? 12 : 0)
  }, 0)
  const strokeRatios = lines.map((line) => line.strokeThickness / Math.max(line.targetStroke, 1))
  const strokeSpread = strokeRatios.length > 1
    ? Math.max(...strokeRatios) - Math.min(...strokeRatios)
    : 0
  const strokeVariance = strokeRatios.reduce((sum, ratio) => sum + (ratio - 1) ** 2, 0)
    / Math.max(strokeRatios.length, 1)
  const weightOrderPenalty = lines.reduce((sum, line, index) => sum + lines.slice(index + 1).reduce((pairSum, other) => {
    const sizeDifference = line.fontSize - other.fontSize
    const weightDifference = line.fontWeight - other.fontWeight
    if (sizeDifference * weightDifference <= 0) return pairSum
    return pairSum + Math.abs(weightDifference) * Math.abs(sizeDifference) / Math.max(meanChars, 1) * 0.015
  }, 0), 0)
  const weightHarmonyPenalty = strokeSpread ** 2 * 40 + strokeVariance * 24 + weightOrderPenalty
  const lineDetails = lines.map((line, index) => {
    const deficit = Math.max(0, zone.minimum - line.fontSize) / Math.max(zone.minimum, 1)
    const severeDeficit = Math.max(0, zone.minimum - line.fontSize) / Math.max(zone.ideal, 1)
    const excess = zone.paddingEligible ? Math.max(0, line.fontSize - zone.maximum) / Math.max(zone.ideal, 1) : 0
    const minimumPenalty = deficit ** 2 * 420 + severeDeficit ** 2 * 140
    const compression = Math.max(0, 1 - line.scaleX)
    const expansion = Math.max(0, line.scaleX - 1)
    const overflowPenalty = line.overflow
      ? 120 + Math.max(0, line.fittedWidth / Math.max(zone.contentWidth, 1) - 1 / MIN_SCALE_X) * 80
      : 0
    const shortPenalty = charCounts.length === 1
      ? 0
      : charCounts[index]! <= 2
        ? 34
        : index < charCounts.length - 1 && charCounts[index]! / Math.max(meanChars, 1) < 0.56
          ? (0.56 - charCounts[index]! / Math.max(meanChars, 1)) ** 2 * 42
          : index === charCounts.length - 1 && charCounts[index]! / Math.max(meanChars, 1) < 0.3
            ? (0.3 - charCounts[index]! / Math.max(meanChars, 1)) ** 2 * 10
            : 0
    const lineBalancePenalty = (lineBalanceValues[index]! - 1) ** 2 * 10
    const strokePenalty = ((strokeRatios[index] ?? 1) - 1) ** 2 * 24
    return {
      text: line.text,
      characterCount: charCounts[index] ?? 0,
      balanceRatio: round(lineBalanceValues[index] ?? 1),
      absoluteWeight: line.absoluteWeight,
      relativeWeight: line.relativeWeight,
      fontWeight: line.fontWeight,
      targetStroke: round(line.targetStroke),
      strokeThickness: round(line.strokeThickness),
      strokeRatio: round(line.strokeThickness / Math.max(line.targetStroke, 1), 4),
      fontSizeDeficit: round(minimumPenalty),
      compression: round(compression, 4),
      expansion: round(expansion, 4),
      letterSpacing: round(line.letterSpacing),
      overflow: line.overflow,
      penalties: [
        { key: 'minimum-size', label: '低于推荐小', points: round(minimumPenalty), reason: `字号 ${round(line.fontSize)}px，推荐小 ${round(zone.minimum)}px；非线性重罚` },
        { key: 'maximum-size', label: '超过推荐大', points: round(excess * excess * 8), reason: zone.paddingEligible ? `字号 ${round(line.fontSize)}px，推荐大 ${round(zone.maximum)}px` : '窄瓷砖不限制上限' },
        { key: 'compression', label: '横向压缩', points: round(compression * 14), reason: `scaleX ${round(line.scaleX, 4)}，下限 ${MIN_SCALE_X}` },
        { key: 'expansion', label: '横向扩张', points: round(expansion * 1.7), reason: `scaleX ${round(line.scaleX, 4)}` },
        { key: 'letter-spacing', label: '字距扩张', points: round(line.letterSpacing * 0.8), reason: `字距 ${round(line.letterSpacing)}px` },
        { key: 'overflow', label: '溢出', points: round(overflowPenalty), reason: line.overflow ? '即使压缩到 0.8 仍无法容纳' : '未溢出' },
        { key: 'line-balance', label: '本行均衡', points: round(lineBalancePenalty), reason: `相对均衡值 ${round(lineBalanceValues[index] ?? 1)}` },
        { key: 'stroke-balance', label: '笔画厚度', points: round(strokePenalty), reason: `实际 ${round(line.strokeThickness)}，目标 ${round(line.targetStroke)}，比例 ${round(strokeRatios[index] ?? 1, 4)}` },
        { key: 'short-line', label: '短行', points: round(shortPenalty), reason: `本行 ${charCounts[index] ?? 0} 个有效字符` },
      ].filter((item) => item.points > 0),
    } satisfies LayoutLineScore
  })
  const sizeDeficit = lineDetails.reduce((sum, line) => sum + line.fontSizeDeficit, 0) / Math.max(lines.length, 1)
  const transformPenalty = lineDetails.reduce((sum, line) => {
    return sum + line.compression * 14 + line.expansion * 1.7 + line.letterSpacing * 0.8
  }, 0) / Math.max(lines.length, 1)
  const overflowPenalty = lineDetails.reduce((sum, line) => sum + (line.overflow ? line.penalties.find((item) => item.key === 'overflow')?.points ?? 0 : 0), 0)
  const sizeScore = -(sizeDeficit + Math.abs(Math.log(baseSize / Math.max(zone.ideal, 1))) * 1.2)
  const balanceScore = -(shortLinePenalty + balancePenalty + numericOrSymbolPenalty)
  const weightScore = -weightHarmonyPenalty
  const readabilityScore = -(linePenalty + hardBreakPenalty)
  const naturalTextScore = -(lines.reduce((sum, line) => sum + Math.abs(Math.log(line.scaleX)), 0) / Math.max(lines.length, 1))
  const transformScore = -transformPenalty
  const baseSizePenalty = Math.abs(Math.log(baseSize / Math.max(zone.ideal, 1))) * 1.2
  const total = sizeScore + balanceScore + weightScore + readabilityScore + naturalTextScore + transformScore - overflowPenalty
  const penalties: LayoutPenalty[] = [
    { key: 'minimum-size', label: '低于推荐小', points: round(sizeDeficit), reason: '按每行低于推荐小的比例平方重罚，严重偏小时再叠加更强惩罚' },
    { key: 'base-size', label: '基准字号偏离', points: round(baseSizePenalty), reason: `基准字号 ${round(baseSize)}px，推荐适合 ${round(zone.ideal)}px` },
    { key: 'line-count', label: '额外行数', points: round(linePenalty), reason: `多出 ${Math.max(0, lines.length - 1)} 行，每行 ${1.1} 分` },
    { key: 'short-lines', label: '短行', points: round(shortLinePenalty), reason: '避免非末行过短、末行过短或只剩一两个字符' },
    { key: 'line-balance', label: '行长不协调', points: round(balancePenalty), reason: '综合字符数和原生视觉宽度计算离散程度' },
        { key: 'weight-harmony', label: '字重关系', points: round(weightHarmonyPenalty), reason: '惩罚较大字号反而比较小字号更粗的关系' },
    { key: 'numeric-symbol', label: '数字或符号孤行', points: round(numericOrSymbolPenalty), reason: '避免数字、&、+ 等单独成为非末行' },
    { key: 'hard-break', label: '词内断行', points: round(hardBreakPenalty), reason: `每个词内断行 ${2.4} 分` },
    { key: 'scale', label: '自然宽度偏离', points: round(-naturalTextScore), reason: `scaleX 偏离 1 的程度` },
    { key: 'transform', label: '字体变形', points: round(-transformScore), reason: '综合横向压缩、扩张和字距扩张' },
    { key: 'overflow', label: '溢出', points: round(overflowPenalty), reason: '压缩到 0.8 后仍放不下时重罚' },
  ].filter((item) => item.points > 0)
  return {
    size: round(sizeScore),
    lines: round(-linePenalty),
    balance: round(balanceScore),
    weight: round(weightScore),
    readability: round(readabilityScore),
    naturalText: round(naturalTextScore),
    transform: round(transformScore),
    breaks: round(-hardBreakPenalty),
    total: round(total),
    penalties,
    linesDetail: lineDetails,
  } satisfies LayoutBreakdown
}

function dedupeCandidates(candidates: LayoutCandidate[]) {
  const seen = new Set<string>()
  return candidates.filter((candidate) => {
    const key = candidate.lines.map((line) => line.text).join('|')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function buildCandidates(options: ResolvedTextLayoutOptions, zone: ComfortZone) {
  const candidates: LayoutCandidate[] = []
  sizeCandidates(zone, options.maxSize).forEach((baseSize, sizeIndex) => {
    const absoluteWeight = absoluteWeightFor(baseSize, options.maxSize)
    const generationWeights = [...new Set([
      absoluteWeight,
      clamp(absoluteWeight + 110, SCHEDULE_FONT.weightMin, SCHEDULE_FONT.weightMax),
      clamp(absoluteWeight - 90, SCHEDULE_FONT.weightMin, SCHEDULE_FONT.weightMax),
    ])]
    const partitions = generationWeights
      .flatMap((generationWeight) => partitionText(options.text, options, baseSize, generationWeight))
      .filter((partition, index, all) => all.findIndex((other) => (
        other.texts.join('|') === partition.texts.join('|')
        && other.hardBreaks.join('|') === partition.hardBreaks.join('|')
      )) === index)
    partitions.forEach((partition, partitionIndex) => {
      const fitted = fitCandidateLines(partition.texts, options, baseSize, zone, partition.hardBreaks)
      const lines = fitted.lines
      const breakdown = scoreCandidate(lines, baseSize, zone, partition.hardBreaks.some(Boolean) ? 'hard-break' : 'normal')
      candidates.push({
        id: `${sizeIndex}-${partitionIndex}`,
        source: partition.hardBreaks.some(Boolean) ? 'hard-break' : 'normal',
        baseSize,
        weightIterations: fitted.iterations,
        lines,
        score: breakdown.total,
        breakdown,
      })
    })
  })
  return dedupeCandidates(candidates.sort((a, b) => b.score - a.score)).slice(0, MAX_CANDIDATES)
}

function candidateSignature(candidate: LayoutCandidate | undefined) {
  return candidate?.lines.map((line) => [line.text, line.fontSize, line.fontWeight, line.letterSpacing, line.scaleX].join(':')).join('|') ?? ''
}

function refineComfort(zone: ComfortZone, candidate: LayoutCandidate) {
  const averageSize = candidate.lines.reduce((sum, line) => sum + line.fontSize, 0) / Math.max(candidate.lines.length, 1)
  const ideal = Math.max(
    zone.ideal,
    clamp(
      averageSize,
      zone.ideal,
      zone.paddingEligible ? zone.maximum : Math.max(zone.maximum, averageSize),
    ),
  )
  return {
    ...zone,
    minimum: Math.max(SEARCH_FLOOR_SIZE, ideal * 0.8),
    ideal,
    maximum: Math.max(SEARCH_FLOOR_SIZE, ideal * 1.32),
  } satisfies ComfortZone
}

function resolveOptions(options: TextLayoutOptions): ResolvedTextLayoutOptions {
  return {
    ...options,
    fontFamily: options.fontFamily ?? `'${SCHEDULE_FONT.family}', sans-serif`,
    maxSize: options.maxSize ?? 22,
    spacingCap: options.spacingCap ?? 0,
    role: options.role ?? 'debug',
  }
}

function computeTextLayout(options: ResolvedTextLayoutOptions): TextLayoutResult {
  const width = Math.max(1, Math.round(options.width * 2) / 2)
  const cacheKey = [options.text, width, options.fontFamily, options.maxSize, options.spacingCap, options.role ?? '', options.viewportWidth ?? ''].join('::')
  const cached = cache.get(cacheKey)
  if (cached) return cached
  const normalized = { ...options, width }
  const comfort = deriveComfort(normalized)
  let effectiveComfort = comfort
  let candidates: LayoutCandidate[] = []
  let previousSignature = ''
  let iterations = 0
  for (let iteration = 0; iteration < 3; iteration++) {
    const candidateOptions = { ...normalized, width: effectiveComfort.contentWidth }
    candidates = buildCandidates(candidateOptions, effectiveComfort)
    iterations = iteration + 1
    const current = candidates[0]
    const signature = candidateSignature(current)
    if (!current || signature === previousSignature) break
    previousSignature = signature
    effectiveComfort = refineComfort(effectiveComfort, current)
  }
  const selected = candidates[0] ?? {
    id: 'empty', source: 'normal' as const, baseSize: comfort.ideal, weightIterations: 0, lines: [], score: Number.NEGATIVE_INFINITY,
    breakdown: {
      size: 0,
      lines: 0,
      balance: 0,
      weight: 0,
      readability: 0,
      naturalText: 0,
      transform: 0,
      breaks: 0,
      total: 0,
      penalties: [],
      linesDetail: [],
    },
  }
  const result = {
    text: options.text,
    width,
    fontFamily: options.fontFamily,
    maxSize: options.maxSize,
    spacingCap: options.spacingCap,
    role: options.role,
    viewportWidth: options.viewportWidth ?? (typeof window === 'undefined' ? 1200 : window.innerWidth),
    comfort,
    effectiveComfort,
    selected,
    candidates,
    iterations,
    cacheKey,
  }
  cache.set(cacheKey, result)
  if (cache.size > 600) cache.delete(cache.keys().next().value as string)
  return result
}

/** The normal rendering API. The scoring engine still computes the full result internally. */
export function layoutText(options: TextLayoutOptions): LayoutCandidate {
  return inspectTextLayout(options).selected
}

/** The auditable API used by the debug route and diagnostics. */
export function inspectTextLayout(options: TextLayoutOptions): TextLayoutResult {
  return computeTextLayout(resolveOptions(options))
}

export function createTextLayoutDebugLog(result: TextLayoutResult, activeCandidateId = result.selected.id) {
  return {
    input: {
      text: result.text,
      width: result.width,
      fontFamily: result.fontFamily,
      maxSize: result.maxSize,
      spacingCap: result.spacingCap,
      role: result.role,
      viewportWidth: result.viewportWidth,
    },
    selectedCandidateId: result.selected.id,
    activeCandidateId,
    comfort: result.comfort,
    effectiveComfort: result.effectiveComfort,
    iterations: result.iterations,
    candidates: result.candidates,
  }
}

export function serializeTextLayoutDebug(result: TextLayoutResult, activeCandidateId = result.selected.id) {
  return JSON.stringify(createTextLayoutDebugLog(result, activeCandidateId), null, 0)
}

export function createTextLayoutCandidateDebugLog(result: TextLayoutResult, candidateId: string) {
  const candidate = result.candidates.find((item) => item.id === candidateId) ?? result.selected
  return {
    input: {
      text: result.text,
      cellWidth: result.width,
      fontFamily: result.fontFamily,
      maxSize: result.maxSize,
      spacingCap: result.spacingCap,
      role: result.role,
    },
    comfort: {
      minimum: result.comfort.minimum,
      ideal: result.comfort.ideal,
      maximum: result.comfort.maximum,
      padding: result.comfort.padding,
      contentWidth: result.comfort.contentWidth,
    },
    model: {
      font: SCHEDULE_FONT,
      strokeProfile: STROKE_PROFILE,
    },
    candidate,
  }
}

export function serializeTextLayoutCandidateDebug(result: TextLayoutResult, candidateId: string) {
  return JSON.stringify(createTextLayoutCandidateDebugLog(result, candidateId), null, 0)
}

export function logTextLayoutCandidateDebug(result: TextLayoutResult, candidateId: string) {
  const record = createTextLayoutCandidateDebugLog(result, candidateId)
  console.info(`[text-layout:${record.candidate.id}]`, record)
  return record
}

export function logTextLayoutDebug(result: TextLayoutResult, activeCandidateId = result.selected.id) {
  const record = createTextLayoutDebugLog(result, activeCandidateId)
  console.groupCollapsed(`[text-layout] ${result.text}`)
  console.log(record)
  console.table(result.candidates.map((candidate) => ({
    id: candidate.id,
    active: candidate.id === activeCandidateId,
    score: candidate.score,
    lines: candidate.lines.map((line) => line.text).join(' / '),
  })))
  console.groupEnd()
  return record
}

export function clearTextLayoutCache() {
  cache.clear()
  preparedCache.clear()
  measuredWidthCache.clear()
}

export const TEXT_LAYOUT_LIMITS = { minScaleX: MIN_SCALE_X, hardFragmentMin: HARD_FRAGMENT_MIN, maxCandidates: MAX_CANDIDATES }
