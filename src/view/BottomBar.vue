<script setup lang="ts">
import { LibraryBig } from 'lucide-vue-next'
export interface BottomBarItem {
  id: string
  label: string
  icon: 'settings' | 'export' | 'about' | 'courses'
  tone: 'warm' | 'green' | 'blue'
  disabled?: boolean
}

defineProps<{ items: BottomBarItem[] }>()
const emit = defineEmits<{ select: [id: string] }>()
</script>

<template>
  <nav class="bottom-bar" aria-label="底部工具栏">
    <div class="bottom-bar-items">
      <button v-for="item in items" :key="item.id" class="nav-item" :class="`tone-${item.tone}`" type="button" :disabled="item.disabled" @click="emit('select', item.id)">
        <LibraryBig v-if="item.icon === 'courses'" aria-hidden="true"/>
        <svg v-else-if="item.icon === 'settings'" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M8 4v6M16 14v6" stroke-linecap="round"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>
        <svg v-else-if="item.icon === 'export'" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10 18.5h4M12 7v7m0 0-2.5-2.5M12 14l2.5-2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7.25v.1" stroke-linecap="round"/></svg>
        <span>{{ item.label }}</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.bottom-bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 20;
  width: 100vw;
  max-width: 100vw;
  min-width: 0;
  height: calc(var(--bottom-bar-h) + env(safe-area-inset-bottom));
  overflow: visible;
  background: color-mix(in srgb, var(--surface-solid) 90%, transparent);
  box-shadow: var(--shadow-bar);
  backdrop-filter: blur(22px) saturate(1.04);
  -webkit-backdrop-filter: blur(22px) saturate(1.04);
}

.bottom-bar-items {
  position: absolute;
  top: calc(var(--bottom-bar-h) / 2);
  left: 50%;
  width: max-content;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transform: translate(-50%, -50%);
}

.nav-item {
  width: max-content;
  min-width: 0;
  height: 42px;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  color: var(--text);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition: filter var(--duration-fast) var(--ease-standard), transform var(--duration-fast) var(--ease-standard);
}

.nav-item svg {
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  stroke-width: 1.75;
}

.nav-item span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-item:hover:not(:disabled) {
  filter: brightness(1.03);
}

.nav-item:active:not(:disabled) {
  transform: translateY(1px) scale(.99);
}

.nav-item.tone-warm {
  background: var(--block-warm);
}

.nav-item.tone-green {
  background: var(--block-green);
}

.nav-item.tone-blue {
  background: var(--block-blue);
}
</style>
<style scoped>
@media (max-width: 480px) {
  .bottom-bar-items { width: calc(100% - 16px); gap: 4px }
  .nav-item { flex: 1 1 0; width: 0; height: 54px; padding: 6px 2px; flex-direction: column; gap: 5px }
}
</style>
