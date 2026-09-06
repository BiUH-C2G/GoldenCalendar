<script lang="ts">
import { shallowReactive } from 'vue'

interface DialogEntry { id: symbol, panel: () => HTMLElement | null, previousFocus: HTMLElement | null }
const dialogStack = shallowReactive<DialogEntry[]>([])
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = withDefaults(defineProps<{ open: boolean, title: string, closable?: boolean }>(), { closable: true })
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
const panel = ref<HTMLElement | null>(null)
const entry: DialogEntry = { id: Symbol(), panel: () => panel.value, previousFocus: null }
const stackIndex = computed(() => dialogStack.findIndex((item) => item.id === entry.id))
const isTopmost = computed(() => props.open && dialogStack.at(-1)?.id === entry.id)

function focusPanel() {
  const autofocus = panel.value?.querySelector<HTMLElement>('[data-dialog-autofocus]')
  const focusTarget = autofocus ?? focusableElements()[0] ?? panel.value
  focusTarget?.focus({ preventScroll: true })
}

function deactivate() {
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('focusin', handleFocusIn)
  const index = stackIndex.value
  if (index < 0) return
  const wasTopmost = index === dialogStack.length - 1
  const previousFocus = entry.previousFocus
  const next = dialogStack[index + 1]
  // 底层先关闭时，将焦点返回目标交给上层，避免恢复到已经移除的弹窗
  if (next && panel.value?.contains(next.previousFocus)) next.previousFocus = previousFocus
  dialogStack.splice(index, 1)
  entry.previousFocus = null
  if (!wasTopmost) return
  void nextTick(() => {
    const topPanel = dialogStack.at(-1)?.panel()
    if (previousFocus?.isConnected && !previousFocus.closest('[inert]') && (!topPanel || topPanel.contains(previousFocus))) previousFocus.focus({ preventScroll: true })
    else topPanel?.focus({ preventScroll: true })
  })
}

watch(() => props.open, async (open) => {
  if (!open) {
    deactivate()
    return
  }
  entry.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  dialogStack.push(entry)
  document.addEventListener('keydown', handleKeydown)
  document.addEventListener('focusin', handleFocusIn)
  await nextTick()
  if (isTopmost.value) focusPanel()
}, { immediate: true })

onBeforeUnmount(deactivate)

function close() {
  if (isTopmost.value && props.closable) emit('update:open', false)
}

function handleFocusIn(event: FocusEvent) {
  if (isTopmost.value && event.target instanceof Node && !panel.value?.contains(event.target)) focusPanel()
}

function handleKeydown(event: KeyboardEvent) {
  if (!isTopmost.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopImmediatePropagation()
    close()
    return
  }
  if (event.key !== 'Tab') return
  event.stopImmediatePropagation()
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
  return [...panel.value?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), input:not(:disabled), textarea:not(:disabled), summary, [href], [tabindex]:not([tabindex="-1"])') ?? []].filter((element) => element.getClientRects().length > 0 && element.tabIndex >= 0 && !element.closest('[inert]'))
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="open" class="dialog-backdrop" :style="{ zIndex: 60 + Math.max(0, stackIndex) }" :inert="!isTopmost" :aria-hidden="!isTopmost ? true : undefined" @click.self="close">
        <section ref="panel" class="dialog-sheet" role="dialog" :aria-modal="isTopmost ? true : undefined" :aria-label="title" tabindex="-1">
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
