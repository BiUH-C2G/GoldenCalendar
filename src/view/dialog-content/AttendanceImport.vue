<script setup lang="ts">
defineProps<{ count: number, conflicts: number, error: string }>()
</script>

<template>
  <div class="attendance-import">
    <section>
      <h3 class="dialog-group-title">备份内容</h3>
      <p>备份包含 {{ count }} 节记录，其中 {{ conflicts }} 节与本地记录重复</p>
    </section>
    <section>
      <h3 class="dialog-group-title">合并方式</h3>
      <p>同节次以备份为准，其他本地记录保留；未匹配当前课表的记录归入未关联记录</p>
    </section>
    <p v-if="error" class="import-error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.attendance-import {
  display: grid;
  gap: 24px;
  min-width: 0;
  overflow-wrap: anywhere
}

.attendance-import p {
  margin: 0 2px;
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.8
}

.attendance-import .import-error {
  color: var(--danger)
}
</style>
