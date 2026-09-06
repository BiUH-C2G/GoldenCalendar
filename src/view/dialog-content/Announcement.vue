<script setup lang="ts">
defineProps<{ date: string, content: string }>()
</script>

<template>
  <div>
    <p class="announcement-date">公告日期：{{ date }}</p>
    <div class="announcement-content">{{ content }}</div>
  </div>
</template>

<style scoped>
.announcement-date {
  margin: 0 0 12px;
  color: var(--text-muted);
  font-size: 13px;
  overflow-wrap: anywhere
}

.announcement-content {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: var(--text);
  font-size: 14px;
  line-height: 1.8
}
</style>
