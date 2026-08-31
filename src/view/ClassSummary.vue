<script setup lang="ts">
defineProps<{ summary: string }>()
</script>

<template>
  <div class="class-summary">{{ summary }}</div>
</template>

<style scoped>
.class-summary {
  color: var(--text-strong);
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: .055em;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.class-summary-bottom {
  display: none;
}

@media (max-width: 699px) {
  .class-summary-top {
    display: none;
  }

  .class-summary-bottom {
    display: flex;
  }
}
</style>
