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
  panel.value?.querySelector<HTMLElement>('[data-dialog-autofocus], button:not(:disabled), select:not(:disabled), input:not(:disabled)')?.focus()
})

onBeforeUnmount(() => document.removeEventListener('keydown', handleKeydown))

function close() {
  if (props.closable) emit('update:open', false)
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="open" class="dialog-backdrop" @click.self="close">
        <section ref="panel" class="dialog-sheet" role="dialog" aria-modal="true" :aria-label="title">
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
