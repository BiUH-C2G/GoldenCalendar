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

function weightFor(fontSize: number) {
  const progress = Math.min(1, Math.max(0, fontSize / Math.max(props.maxSize, 1)))
  return Math.round(800 - progress * 280)
}

function variationFor(fontWeight: number) {
  return `"wght" ${fontWeight}`
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
) {
  return prepareWithSegments(
    text,
    fontFor(fontFamily, fontSize, fontWeight),
    { whiteSpace: 'pre-wrap', letterSpacing },
  )
}

function containsInternalBreak(line: LayoutLine, prepared: PreparedTextWithSegments) {
  if (line.end.graphemeIndex === 0) return false
  const segment = prepared.segments[line.end.segmentIndex]
  return Boolean(segment && !/^\s/.test(segment))
}

function isAwkwardLine(line: LayoutLine) {
  return /^[0-9]+$/.test(line.text.trim()) || /^[&+\-−]$/.test(line.text.trim())
}

function addHardBreakHyphens(linesToRender: LayoutLine[], prepared: PreparedTextWithSegments) {
  return linesToRender.map((line, index) => ({
    ...line,
    text: index < linesToRender.length - 1 && containsInternalBreak(line, prepared)
      ? `${line.text}-`
      : line.text,
  }))
}

function findWrapLines(width: number, fontFamily: string) {
  let fallback: { lines: LayoutLine[], prepared: PreparedTextWithSegments } | null = null

  // Keep ordinary words intact and avoid orphaned numeric/operator tokens.
  // Pretext handles the actual Unicode-aware greedy wrapping and emergency
  // grapheme breaks at each candidate size.
  for (let fontSize = props.maxSize; fontSize >= SEARCH_FLOOR_SIZE; fontSize -= 0.5) {
    const fontWeight = weightFor(fontSize)
    const prepared = prepareText(props.text, fontFamily, fontSize, fontWeight)
    const result = layoutWithLines(prepared, width, 1)
    const candidate = { lines: result.lines, prepared }
    fallback = candidate
    if (
      !result.lines.some((line) => containsInternalBreak(line, prepared))
      && !result.lines.some(isAwkwardLine)
    ) {
      return candidate
    }
  }

  return fallback
}

function lineWidth(text: string, fontFamily: string, fontSize: number, fontWeight: number, letterSpacing = 0) {
  return measureNaturalWidth(prepareText(text, fontFamily, fontSize, fontWeight, letterSpacing))
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

  return {
    text,
    fontSize,
    fontWeight,
    letterSpacing: spacing,
    scaleX: width / Math.max(fittedWidth, 1),
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
  lines.value = renderedLines
    .map((line) => line.text.trim())
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
