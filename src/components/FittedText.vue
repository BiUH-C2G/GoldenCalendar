<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { layoutText, type LayoutCandidate, type TextRole } from '@/textLayout'

const props = withDefaults(defineProps<{
  text: string
  maxSize?: number
  spacingCap?: number
  role?: TextRole
  candidate?: LayoutCandidate
}>(), {
  maxSize: 22,
  spacingCap: 0,
  role: 'debug',
})

const root = ref<HTMLElement | null>(null)
const lines = ref<LayoutCandidate['lines']>([])
const renderedLines = computed(() => props.candidate?.lines ?? lines.value)
let resizeObserver: ResizeObserver | null = null
let frameId: number | null = null
let timerId: ReturnType<typeof setTimeout> | null = null
let lastWidth = 0
let lastInputKey = ''

function variationFor(fontWeight: number) {
  return `"wght" ${fontWeight}`
}

function fit() {
  if (!root.value) return
  const width = root.value.clientWidth
  if (!width || !props.text.trim()) {
    lines.value = []
    return
  }
  const fontFamily = getComputedStyle(root.value).fontFamily || 'Arial'
  lines.value = layoutText({
    text: props.text,
    width,
    fontFamily,
    maxSize: props.maxSize,
    spacingCap: props.spacingCap,
    role: props.role,
  }).lines
}

function schedule() {
  if (frameId !== null) cancelAnimationFrame(frameId)
  frameId = requestAnimationFrame(() => {
    frameId = null
    if (timerId) clearTimeout(timerId)
    timerId = setTimeout(() => {
      timerId = null
      const width = root.value?.clientWidth ?? 0
      const inputKey = [props.text, props.maxSize, props.spacingCap, props.role].join('::')
      if (Math.abs(width - lastWidth) < 1 && inputKey === lastInputKey) return
      lastWidth = width
      lastInputKey = inputKey
      fit()
    }, 140)
  })
}

watch(() => [props.text, props.maxSize, props.spacingCap, props.role], schedule)

onMounted(async () => {
  resizeObserver = new ResizeObserver(schedule)
  if (root.value) resizeObserver.observe(root.value)
  await nextTick()
  await document.fonts.ready
  schedule()
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  if (frameId !== null) cancelAnimationFrame(frameId)
  if (timerId) clearTimeout(timerId)
})
</script>

<template>
  <span ref="root" class="fit-text">
    <span
      v-for="(line, index) in renderedLines"
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
