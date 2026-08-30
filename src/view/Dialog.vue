<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = withDefaults(defineProps<{ open: boolean, title: string, closable?: boolean }>(), { closable: true })
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
const panel = ref<HTMLElement | null>(null)
let previousFocus: HTMLElement | null = null

watch(() => props.open, async (open) => {
  if (!open) {
    document.removeEventListener('keydown', handleKeydown)
    previousFocus?.focus()
    previousFocus = null
    return
  }
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  document.addEventListener('keydown', handleKeydown)
  await nextTick()
  const autofocus = panel.value?.querySelector<HTMLElement>('[data-dialog-autofocus]')
  const focusTarget = autofocus ?? focusableElements()[0] ?? panel.value
  focusTarget?.focus()
})

onBeforeUnmount(() => document.removeEventListener('keydown', handleKeydown))

function close() {
  if (props.closable) emit('update:open', false)
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    close()
    return
  }
  if (event.key !== 'Tab') return
  const elements = focusableElements()
  if (!elements.length) {
    event.preventDefault()
    panel.value?.focus()
    return
  }
  const currentIndex = elements.indexOf(document.activeElement as HTMLElement)
  const nextIndex = event.shiftKey ? currentIndex <= 0 ? elements.length - 1 : currentIndex - 1 : currentIndex < 0 || currentIndex >= elements.length - 1 ? 0 : currentIndex + 1
  event.preventDefault()
  elements[nextIndex].focus()
}

function focusableElements() {
  return [...panel.value?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])') ?? []].filter((element) => element.getClientRects().length > 0)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="open" class="dialog-backdrop" @click.self="close">
        <section ref="panel" class="dialog-sheet" role="dialog" aria-modal="true" :aria-label="title" tabindex="-1">
          <header class="dialog-head">
            <h2>{{ title }}</h2>
            <button v-if="closable" class="dialog-close" type="button" aria-label="关闭" @click="close">×</button>
          </header>
          <slot />
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
