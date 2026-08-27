<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

interface FitLine {
  text: string
  fontSize: number
  fontWeight: number
  letterSpacing: number
  scaleX: number
}

const props = withDefaults(defineProps<{
  text: string
  minSize: number
  maxSize?: number
  spacingCap?: number
}>(), {
  maxSize: 22,
  spacingCap: 0,
})

const root = ref<HTMLElement | null>(null)
const measureNode = ref<HTMLElement | null>(null)
const lines = ref<FitLine[]>([])
let resizeObserver: ResizeObserver | null = null
const MIN_SCALE_X = 0.8

function weightFor(fontSize: number) {
  const progress = Math.min(
    1,
    Math.max(0, (fontSize - props.minSize) / Math.max(props.maxSize - props.minSize, 1)),
  )
  return Math.round(780 - progress * 260)
}

function variationFor(fontWeight: number) {
  return `"wght" ${fontWeight}`
}

function measure(text: string, fontSize: number, letterSpacing: number, fontWeight = weightFor(fontSize)) {
  if (!root.value || !measureNode.value) return 0
  const rootStyle = getComputedStyle(root.value)
  Object.assign(measureNode.value.style, {
    fontFamily: rootStyle.fontFamily,
    fontWeight: `${fontWeight}`,
    fontVariationSettings: variationFor(fontWeight),
    fontSize: `${fontSize}px`,
    letterSpacing: `${letterSpacing}px`,
  })
  measureNode.value.textContent = text
  return measureNode.value.getBoundingClientRect().width
}

function breakLongToken(token: string, width: number) {
  const characters = Array.from(token)
  let maxCharacters = 1
  let current = ''
  for (const character of characters) {
    if (measure(current + character, props.minSize, 0) > width) break
    current += character
    maxCharacters = current.length
  }

  const lineCount = Math.ceil(characters.length / maxCharacters)
  const shortLineLength = Math.floor(characters.length / lineCount)
  const longLineCount = characters.length % lineCount
  const chunks: string[] = []
  let offset = 0
  for (let index = 0; index < lineCount; index += 1) {
    const length = shortLineLength + (index < longLineCount ? 1 : 0)
    const chunk = characters.slice(offset, offset + length).join('')
    chunks.push(index < lineCount - 1 ? `${chunk}-` : chunk)
    offset += length
  }
  return chunks
}

function splitLine(text: string, width: number) {
  if (!text) return []
  const hasWordBoundaries = /\s/.test(text)
  if (!hasWordBoundaries) {
    return measure(text, props.minSize, 0) <= width
      ? [text]
      : breakLongToken(text, width)
  }

  const tokens = text.split(/\s+/)
  const result: string[] = []
  let current = ''

  for (const token of tokens) {
    const candidate = current ? `${current} ${token}` : token
    const isGlueToken = /^[&+\-−/]+$/.test(token) || /^\d{1,4}[+\-−]*$/.test(token)
    if (!current || measure(candidate, props.minSize, 0) <= width || isGlueToken) {
      current = candidate
      continue
    }

    result.push(current)
    current = token
  }

  if (current) result.push(current)
  return result
}

function splitLines(width: number) {
  return props.text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => splitLine(line, width))
}

function fitLines() {
  if (!root.value || !measureNode.value) return
  const width = root.value.clientWidth
  if (!width) return

  lines.value = splitLines(width).map((text) => {
    const characterCount = Math.max(Array.from(text.replaceAll(' ', '')).length - 1, 1)
    const initialWidth = measure(text, props.minSize, 0)
    const spacing = Math.min(
      props.spacingCap,
      Math.max(0, (width - initialWidth) / characterCount),
    )
    const spacedWidth = measure(text, props.minSize, spacing)
    const fontSize = Math.min(
      props.maxSize,
      Math.max(props.minSize, props.minSize * width / Math.max(spacedWidth, 1)),
    )
    const fontWeight = weightFor(fontSize)
    const fittedWidth = measure(text, fontSize, spacing, fontWeight)
    return {
      text,
      fontSize,
      fontWeight,
      letterSpacing: spacing,
      scaleX: Math.max(MIN_SCALE_X, width / Math.max(fittedWidth, 1)),
    }
  })
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
      v-for="line in lines"
      :key="line.text"
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
    <span ref="measureNode" class="fit-measure" aria-hidden="true" />
  </span>
</template>
