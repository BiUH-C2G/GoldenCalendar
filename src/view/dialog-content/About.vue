<script setup lang="ts">
import {onBeforeUnmount, onMounted, ref} from 'vue'
import {loadDataMetadata} from '@/Data'
import {SHANGHAI_TIMEZONE} from '@/DateTime'
import {loadAnnouncements} from '@/Announcements'
import type {Announcement as AnnouncementData} from '@/Announcements'
import Dialog from '@/view/Dialog.vue'
import Announcement from './Announcement.vue'

const metadataText = ref('课表元数据加载中')
const controller = new AbortController()
const announcements = ref<AnnouncementData[]>([])
const announcementsLoading = ref(true)
const announcementsError = ref('')
const selectedAnnouncement = ref<AnnouncementData | null>(null)
onMounted(async () => {
  try {
    announcements.value = await loadAnnouncements(controller.signal)
  } catch {
    if (!controller.signal.aborted) announcementsError.value = '历史公告暂不可用'
  } finally {
    if (!controller.signal.aborted) announcementsLoading.value = false
  }
})
onMounted(async () => {
  try {
    const metadata = await loadDataMetadata(controller.signal)
    const date = new Intl.DateTimeFormat('zh-CN', {timeZone: SHANGHAI_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).format(new Date(metadata.generatedAt))
    metadataText.value = `当前数据情况：第${metadata.schemaVersion}版格式，生成于北京时间 ${date}`
  } catch {
    if (!controller.signal.aborted) metadataText.value = '课表元数据暂不可用'
  }
})
onBeforeUnmount(() => controller.abort())
</script>
<template>
  <div class="about-area">
    <section class="announcement-history">
      <h3>关于本网站</h3>
      <div class="about-copy">
        <p>作者：25CS 陈俊豪</p>
        <p>如数据展示情况有误或亟待更新，请联系微信 EARZUC</p>
        <p>数据来源于科比，作者不为课表数据源的错误或不详尽负责</p>
        <p aria-live="polite">{{ metadataText }}</p>
      </div>
    </section>

    <section class="announcement-history">
      <h3>历史公告</h3>
      <p v-if="announcementsLoading" role="status">正在加载公告</p>
      <p v-else-if="announcementsError" role="status">{{ announcementsError }}</p>
      <p v-else-if="!announcements.length">暂无公告</p>
      <ul v-else>
        <li v-for="item in announcements" :key="item.id">
          <button type="button" @click="selectedAnnouncement = item"><strong>{{ item.title }}</strong><span>{{ item.id }}</span></button>
        </li>
      </ul>
    </section>
  </div>
  <Dialog :open="selectedAnnouncement !== null" :title="selectedAnnouncement?.title ?? '公告'" @update:open="selectedAnnouncement = null">
    <Announcement v-if="selectedAnnouncement" :date="selectedAnnouncement.id" :content="selectedAnnouncement.content"/>
  </Dialog>
</template>

<style scoped>
.about-area{
  gap: 18px;
  display: flex;
  flex-direction: column;
}

.announcement-history {
  color: var(--text-muted);
  font-size: 14px
}

.announcement-history h3 {
  margin: 0 0 10px;
  color: var(--text-strong);
  font-size: 16px
}

.announcement-history ul {
  margin: 0;
  padding: 0;
  list-style: none
}

.announcement-history li + li {
  margin-top: 6px
}

.announcement-history button {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 12px;
  width: 100%;
  padding: 12px;
  border: 0;
  border-radius: 8px;
  background: var(--surface-subtle);
  color: var(--text-strong);
  text-align: left;
  cursor: pointer;
  overflow-wrap: anywhere
}

.announcement-history strong {
  min-width: 0;
  font-size: 14px;
  font-weight: 600
}

.announcement-history span {
  color: var(--text-muted);
  font-size: 13px
}

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
