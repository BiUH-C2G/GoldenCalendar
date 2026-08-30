<script setup lang="ts">
export interface BottomBarItem {
  id: string
  label: string
  icon: 'settings' | 'export' | 'about'
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
        <svg v-if="item.icon === 'settings'" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M8 4v6M16 14v6" stroke-linecap="round"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>
        <svg v-else-if="item.icon === 'export'" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10 18.5h4M12 7v7m0 0-2.5-2.5M12 14l2.5-2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7.25v.1" stroke-linecap="round"/></svg>
        <span>{{ item.label }}</span>
      </button>
    </div>
  </nav>
</template>
