<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { loadDataMetadata } from '@/Data'
import { SHANGHAI_TIMEZONE } from '@/DateTime'

const metadataText = ref('课表元数据加载中')
const controller = new AbortController()
onMounted(async () => {
  try {
    const metadata = await loadDataMetadata(controller.signal)
    const date = new Intl.DateTimeFormat('zh-CN', { timeZone: SHANGHAI_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(metadata.generatedAt))
    metadataText.value = `当前数据情况：第${metadata.schemaVersion}版格式，生成于北京时间 ${date}`
  } catch {
    if (!controller.signal.aborted) metadataText.value = '课表元数据暂不可用'
  }
})
onBeforeUnmount(() => controller.abort())
</script>
<template>
  <div class="about-copy">
    <p>作者：25CS 陈俊豪</p>
    <p>如数据展示情况有误或亟待更新，请联系微信 EARZUC</p>
    <p>数据来源于科比，作者不为课表数据源的错误或不详尽负责</p>
    <p aria-live="polite">{{ metadataText }}</p>
  </div>
</template>

<style scoped>
.about-copy {
  margin: 18px 2px 4px;
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.8;
}

.about-copy p {
  margin: 0;
}

.about-copy p + p {
  margin-top: 12px;
}
</style>
