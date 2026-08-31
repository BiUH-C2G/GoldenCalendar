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

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
  background: var(--scrim);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.dialog-sheet {
  width: min(calc(100% - 32px), 620px);
  max-height: calc(100vh - 32px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  max-height: calc(100dvh - 32px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  overflow: auto;
  padding: 18px;
  border-radius: 26px;
  color: var(--text);
  background: color-mix(in srgb, var(--surface-solid) 97%, transparent);
  box-shadow: var(--shadow-3);
}

.dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}

.dialog-head h2 {
  margin: 0;
  color: var(--text-strong);
  font-family: var(--font-display);
  font-size: 23px;
  font-weight: 600;
  text-align: left;
}

.dialog-close {
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  border: 0;
  border-radius: 50%;
  color: var(--text);
  background: var(--block-warm);
  cursor: pointer;
}

.dialog-enter-active, .dialog-leave-active {
  transition: opacity var(--duration-base) var(--ease-standard);
}

.dialog-enter-active .dialog-sheet, .dialog-leave-active .dialog-sheet {
  transition: transform var(--duration-base) var(--ease-standard), opacity var(--duration-base) var(--ease-standard);
}

.dialog-enter-from, .dialog-leave-to {
  opacity: 0;
}

.dialog-enter-from .dialog-sheet, .dialog-leave-to .dialog-sheet {
  opacity: 0;
  transform: scale(.975);
}

@media (max-width: 560px) {
  .dialog-sheet {
    width: min(calc(100% - 16px), 620px);
    padding: 16px;
    border-radius: 22px;
  }
}
</style>
