<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  layoutWithLines,
  measureNaturalWidth,
  prepareWithSegments,
  type LayoutLine,
  type PreparedTextWithSegments,
} from '@chenglou/pretext'

interface FitLine {
  text: string
  fontSize: number
  fontWeight: number
  letterSpacing: number
  scaleX: number
}

interface WrapCandidate {
  lines: LayoutLine[]
  prepared: PreparedTextWithSegments
  fontSize: number
}

const props = withDefaults(defineProps<{
  text: string
  maxSize?: number
  spacingCap?: number
}>(), {
  maxSize: 22,
  spacingCap: 0,
})

const root = ref<HTMLElement | null>(null)
const lines = ref<FitLine[]>([])
let resizeObserver: ResizeObserver | null = null
const SEARCH_FLOOR_SIZE = 1
const SINGLE_LINE_COMFORT_RATIO = 0.65
const SINGLE_LINE_COMFORT_PENALTY = 5
const LONG_WORD_BREAK_RATIO = 1.25
const MIN_HARD_FRAGMENT_LENGTH = 4
const MIN_SCALE_X = 0.8

function weightFor(fontSize: number) {
  const progress = Math.min(1, Math.max(0, fontSize / Math.max(props.maxSize, 1)))
  return Math.round(800 - progress * 280)
}

function variationFor(fontWeight: number) {
  return `"wght" ${fontWeight}`
}

function insertLongWordBreaks(
  text: string,
  fontFamily: string,
  fontSize: number,
  fontWeight: number,
  maxWidth: number,
) {
  return text.replace(/\S+/g, (word) => {
    const wordWidth = measureNaturalWidth(
      prepareWithSegments(word, fontFor(fontFamily, fontSize, fontWeight), { wordBreak: 'normal' }),
    )
    if (wordWidth <= maxWidth * LONG_WORD_BREAK_RATIO) return word
    const characters = Array.from(word)
    const splitIndex = Math.ceil(characters.length / 2)
    return `${characters.slice(0, splitIndex).join('')}\u00ad${characters.slice(splitIndex).join('')}`
  })
}

function containsBreakableWord(text: string, fontFamily: string, fontSize: number, fontWeight: number, maxWidth: number) {
  return text.split(/\s+/).some((word) => measureNaturalWidth(
    prepareWithSegments(word, fontFor(fontFamily, fontSize, fontWeight), { wordBreak: 'normal' }),
  ) > maxWidth * LONG_WORD_BREAK_RATIO)
}

function fontFor(fontFamily: string, fontSize: number, fontWeight: number) {
  return `${fontWeight} ${fontSize}px ${fontFamily}`
}

function prepareText(
  text: string,
  fontFamily: string,
  fontSize: number,
  fontWeight: number,
  letterSpacing = 0,
  breakLongWords = true,
  maxWidth?: number,
) {
  return prepareWithSegments(
    breakLongWords && maxWidth
      ? insertLongWordBreaks(text, fontFamily, fontSize, fontWeight, maxWidth)
      : text,
    fontFor(fontFamily, fontSize, fontWeight),
    { whiteSpace: 'pre-wrap', wordBreak: 'normal', letterSpacing },
  )
}

function containsInternalBreak(line: LayoutLine, prepared: PreparedTextWithSegments) {
  if (line.end.graphemeIndex === 0) return false
  const segment = prepared.segments[line.end.segmentIndex]
  return Boolean(segment && !/^\s/.test(segment))
}

function isAwkwardLine(line: LayoutLine, index: number, total: number) {
  if (index === total - 1) return false
  return /^[0-9]+$/.test(line.text.trim()) || /^[&+\-−]$/.test(line.text.trim())
}

function addHardBreakHyphens(linesToRender: LayoutLine[], prepared: PreparedTextWithSegments) {
  return linesToRender.map((line, index) => ({
    ...line,
    text: index < linesToRender.length - 1
      && containsInternalBreak(line, prepared)
      && !/[+\-−]$/.test(line.text.trim())
      ? `${line.text}-`
      : line.text,
  }))
}

function mergeShortHardFragments(linesToRender: string[]) {
  const mergedLines = [...linesToRender]
  for (let index = 0; index < mergedLines.length - 1; index++) {
    const trimmedLine = mergedLines[index]!.trim()
    if (!/[+\-−]$/.test(trimmedLine)) continue
    const currentFragment = trimmedLine.replace(/[+\-−]$/, '')
    const nextLine = mergedLines[index + 1]!.trim()
    const nextFragment = nextLine.split(/\s+/)[0] ?? ''
    if (
      Array.from(currentFragment).length < MIN_HARD_FRAGMENT_LENGTH
      || Array.from(nextFragment).length < MIN_HARD_FRAGMENT_LENGTH
    ) {
      mergedLines[index] = `${currentFragment}${nextLine}`.trim()
      mergedLines.splice(index + 1, 1)
      index--
    }
  }
  return mergedLines
}

function repairTrailingNumericLine(linesToRender: string[]) {
  if (linesToRender.length < 2) return linesToRender
  const lastIndex = linesToRender.length - 1
  const trailingNumber = linesToRender[lastIndex]!.trim()
  if (!/^\d+$/.test(trailingNumber)) return linesToRender

  const previousLine = linesToRender[lastIndex - 1]!.trim()
  if (!previousLine) return linesToRender

  // A trailing number belongs with the preceding course-name fragment. If
  // the preceding line already ends in a range marker, join it directly;
  // otherwise split its final word and keep the number with the second half.
  if (/[+\-−]$/.test(previousLine)) {
    linesToRender[lastIndex - 1] = `${previousLine}${trailingNumber}`
    linesToRender.pop()
    return linesToRender
  }

  const match = previousLine.match(/^(.*?)([^\s]+)$/)
  if (!match) return linesToRender
  const [, prefix, word] = match
  const characters = Array.from(word)
  if (characters.length < 2) return linesToRender

  const splitIndex = Math.ceil(characters.length / 2)
  const firstPart = characters.slice(0, splitIndex).join('')
  const secondPart = characters.slice(splitIndex).join('')
  linesToRender[lastIndex - 1] = `${prefix}${firstPart}-`.trim()
  linesToRender[lastIndex] = `${secondPart} ${trailingNumber}`
  return linesToRender
}

function findWrapLines(width: number, fontFamily: string) {
  // Keep short text on one line when it can fit without making it
  // disproportionately small. This policy is shared by course titles,
  // teacher names and rooms; only the content's measured width decides.
  if (!/\r?\n/.test(props.text)) {
    let singleLineSize = props.maxSize
    let singleLineWeight = weightFor(singleLineSize)
    let singleLineWidth = lineWidth(props.text, fontFamily, singleLineSize, singleLineWeight)
    while (singleLineWidth > width && singleLineSize > SEARCH_FLOOR_SIZE) {
      singleLineSize = Math.max(SEARCH_FLOOR_SIZE, singleLineSize - 0.25)
      singleLineWeight = weightFor(singleLineSize)
      singleLineWidth = lineWidth(props.text, fontFamily, singleLineSize, singleLineWeight)
    }
    if (singleLineSize >= props.maxSize * SINGLE_LINE_COMFORT_RATIO) {
      const prepared = prepareText(props.text, fontFamily, singleLineSize, singleLineWeight)
      return {
        lines: layoutWithLines(prepared, 100000, 1).lines,
        prepared,
      }
    }
  }

  let fallback: WrapCandidate | null = null
  let bestCandidate: WrapCandidate | null = null
  let bestScore = Number.NEGATIVE_INFINITY
  const hasNumericToken = /(^|\s)\d+(?=\s|$)/.test(props.text)
  const hasBreakableWord = containsBreakableWord(
    props.text,
    fontFamily,
    props.maxSize,
    weightFor(props.maxSize),
    width,
  )

  // Try conservative and long-word layouts at each size. The score keeps
  // readable lines while rejecting numeric or tiny hard-break fragments.
  for (let fontSize = props.maxSize; fontSize >= SEARCH_FLOOR_SIZE; fontSize -= 0.5) {
    const fontWeight = weightFor(fontSize)
    const modes = hasBreakableWord ? [false, true] : [false]

    for (const breakLongWords of modes) {
      const prepared = prepareText(props.text, fontFamily, fontSize, fontWeight, 0, breakLongWords, width)
      const result = layoutWithLines(prepared, width, 1)
      const candidate = { lines: result.lines, prepared, fontSize }
      fallback ??= candidate

      const hasInternalBreak = result.lines.some((line) => containsInternalBreak(line, prepared))
      const hasAwkwardLine = result.lines.some((line, index) => isAwkwardLine(line, index, result.lines.length))
      const renderedLineTexts = mergeShortHardFragments(
        addHardBreakHyphens(result.lines, prepared).map((line) => line.text.trim()),
      )
      const repairedLineTexts = repairTrailingNumericLine([...renderedLineTexts])
      const lineCount = repairedLineTexts.filter(Boolean).length

      let score = (fontSize / props.maxSize) * 6 - lineCount * 1.35
      if (hasInternalBreak) score -= 0.35
      if (breakLongWords && hasInternalBreak && !hasNumericToken) score += 2.4
      if (hasNumericToken && hasInternalBreak) score -= 30
      if (fontSize / props.maxSize < SINGLE_LINE_COMFORT_RATIO && !hasInternalBreak) score -= SINGLE_LINE_COMFORT_PENALTY
      if (hasNumericToken && lineCount === 1 && fontSize / props.maxSize < SINGLE_LINE_COMFORT_RATIO) score -= 8
      if (hasAwkwardLine) score -= 30

      if (score > bestScore) {
        bestScore = score
        bestCandidate = candidate
      }
    }
  }

  return bestCandidate ?? fallback
}

function lineWidth(text: string, fontFamily: string, fontSize: number, fontWeight: number, letterSpacing = 0) {
  return measureNaturalWidth(prepareText(text, fontFamily, fontSize, fontWeight, letterSpacing, false))
}

function fitLine(text: string, width: number, fontFamily: string): FitLine {
  let fontSize = props.maxSize
  let fontWeight = weightFor(fontSize)
  let naturalWidth = lineWidth(text, fontFamily, fontSize, fontWeight)

  while (naturalWidth > width && fontSize > SEARCH_FLOOR_SIZE) {
    fontSize = Math.max(SEARCH_FLOOR_SIZE, fontSize - 0.25)
    fontWeight = weightFor(fontSize)
    naturalWidth = lineWidth(text, fontFamily, fontSize, fontWeight)
  }

  const characterCount = Math.max(Array.from(text).length - 1, 1)
  const spacing = Math.min(
    props.spacingCap,
    Math.max(0, (width - naturalWidth) / characterCount),
  )
  const fittedWidth = lineWidth(text, fontFamily, fontSize, fontWeight, spacing)
  const naturalScaleX = width / Math.max(fittedWidth, 1)

  return {
    text,
    fontSize,
    fontWeight,
    letterSpacing: spacing,
    // Fill the line whenever possible. Only prevent excessive compression;
    // expansion is intentional because each line is meant to occupy its cell.
    scaleX: Math.max(MIN_SCALE_X, naturalScaleX),
  }
}

function fitLines() {
  if (!root.value) return
  const width = root.value.clientWidth
  if (!width || !props.text.trim()) {
    lines.value = []
    return
  }

  const rootStyle = getComputedStyle(root.value)
  const fontFamily = rootStyle.fontFamily || 'Arial'
  const wrapped = findWrapLines(width, fontFamily)
  if (!wrapped) {
    lines.value = []
    return
  }

  const renderedLines = addHardBreakHyphens(wrapped.lines, wrapped.prepared)
  const lineTexts = repairTrailingNumericLine(
    mergeShortHardFragments(renderedLines.map((line) => line.text.trim())),
  )
  lines.value = lineTexts
    .filter(Boolean)
    .map((text) => fitLine(text, width, fontFamily))
}

async function scheduleFit() {
  await nextTick()
  fitLines()
}

watch(() => props.text, scheduleFit)

onMounted(() => {
  resizeObserver = new ResizeObserver(scheduleFit)
  if (root.value) resizeObserver.observe(root.value)
  scheduleFit()
})

onUnmounted(() => resizeObserver?.disconnect())
</script>

<template>
  <span ref="root" class="fit-text">
    <span
      v-for="(line, index) in lines"
      :key="`${index}-${line.text}`"
      class="fit-line"
    >
      <span
        class="fit-glyph"
        :style="{
          fontSize: `${line.fontSize}px`,
          fontWeight: line.fontWeight,
          fontVariationSettings: variationFor(line.fontWeight),
          letterSpacing: `${line.letterSpacing}px`,
          transform: `translateX(-50%) scaleX(${line.scaleX})`,
        }"
      >{{ line.text }}</span>
    </span>
  </span>
</template>
