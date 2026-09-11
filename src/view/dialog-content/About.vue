<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref} from 'vue'
import {dataContract, getGermanSection} from '@/Contract'
import {loadDataMetadata} from '@/Data'
import {SHANGHAI_TIMEZONE} from '@/DateTime'
import type {CourseOverride, Selection} from '@/Types'
import {loadAnnouncements} from '@/Announcements'
import type {Announcement as AnnouncementData} from '@/Announcements'
import Dialog from '@/view/Dialog.vue'
import Announcement from './Announcement.vue'

const props = defineProps<{ selection: Selection | null }>()
const metadataText = ref('课表元数据加载中')
const donationQrUrl = `${import.meta.env.BASE_URL}images/wechat-donation-qr.png`
const controller = new AbortController()
const metadata = ref<Awaited<ReturnType<typeof loadDataMetadata>> | null>(null)
const announcements = ref<AnnouncementData[]>([])
const announcementsLoading = ref(true)
const announcementsError = ref('')
const selectedAnnouncement = ref<AnnouncementData | null>(null)
const overrideDialogOpen = ref(false)
const selectedOverrides = computed(() => metadata.value?.overrides.filter((item) => matchesSelection(item, props.selection)) ?? [])
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
    metadata.value = await loadDataMetadata(controller.signal)
    const date = new Intl.DateTimeFormat('zh-CN', {timeZone: SHANGHAI_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).format(new Date(metadata.value.generatedAt))
    metadataText.value = `当前数据情况：第${metadata.value.schemaVersion}版格式，生成于北京时间 ${date}`
  } catch {
    if (!controller.signal.aborted) metadataText.value = '课表元数据暂不可用'
  }
})
onBeforeUnmount(() => controller.abort())

function matchesSelection(item: CourseOverride, selection: Selection | null) {
  if (!selection) return false
  const match = item.match
  if (match.kind === 'administrative') return match.grade === selection.grade && match.majorCode === selection.majorCode && (!match.groupId || match.groupId === selection.groupId)
  if (match.kind === 'german') return match.section === getGermanSection(selection.grade)?.section && match.level === selection.germanLevel && match.classNumber === selection.germanClassNumber
  if (match.kind === 'english') return match.section === dataContract.languages.english.section && match.classNumber === selection.englishClassNumber
  if (match.kind === 'englishCatchup') return selection.englishCatchupEnabled && match.classNumber === selection.englishCatchupClassNumber
  return match.groupId === selection.physicalEducationGroupId
}

function overrideTitle(item: CourseOverride) {
  const match = item.match
  if (match.kind === 'administrative') return `${match.title ?? '行政班课程'}${match.teacher ? `（${match.teacher}）` : ''}`
  if (match.kind === 'german') return `德语 ${match.level} ${match.classNumber} 班`
  if (match.kind === 'english') return `英语 ${match.classNumber} 班`
  if (match.kind === 'englishCatchup') return `英语补课 ${match.classNumber} 班`
  return `体育第 ${match.groupId} 组`
}

function overrideScope(item: CourseOverride) {
  const weeks = item.match.weeks
  return weeks ? `第 ${weeks.from} 至 ${weeks.to} 周` : '全部相关课次'
}
</script>
<template>
  <div class="about-area">
    <button v-if="selectedOverrides.length" class="override-open-button" type="button" @click="overrideDialogOpen = true">查看对你生效的课表覆写</button>

    <section class="announcement-history">
      <h3 class="dialog-group-title">关于本网站</h3>
      <div class="about-copy">
        <p>作者：社长；微信：EARZUC</p>
        <p>如数据展示情况有误或亟待更新，请微信联系我</p>
        <p>数据来源于校方，我不为课表数据源的错误或不详尽负责</p>
        <p>目前加了课表覆写的功能，若您要提出对校方数据的更正，请联系我</p>
        <p>本站系学生团队自我研发、维护和运营，与校IT、教务等无关系</p>
        <p aria-live="polite">{{ metadataText }}</p>
        <p>如果我的网站对您有帮助，欢迎微信打赏我</p>
        <img class="donation-qr" :src="donationQrUrl" alt="微信打赏二维码" width="509" height="509" loading="lazy">
      </div>
    </section>

    <section class="announcement-history">
      <h3 class="dialog-group-title">历史公告</h3>
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
    <Announcement v-if="selectedAnnouncement" :date="selectedAnnouncement!.id" :content="selectedAnnouncement!.content"/>
  </Dialog>
  <Dialog :open="overrideDialogOpen" title="当前课表的课程覆写" @update:open="overrideDialogOpen = $event">
    <p v-if="!props.selection">请先完成课程表设置</p>

    <p v-else-if="!selectedOverrides.length">当前课表没有生效的课程覆写</p>

    <ul v-else class="override-list">
      <li v-for="(item, index) in selectedOverrides" :key="index">
        <strong>{{ overrideTitle(item) }}</strong>
        <span>教室改为 {{ item.set.room }} · {{ overrideScope(item) }}</span>
        <span>原因：{{ item.reason }}<br>本条规则于 {{ item.proposedAt }} 由 {{ item.proposedBy }} 提出</span>
      </li>
    </ul>
  </Dialog>
</template>

<style scoped>
.donation-qr { display: block; width: min(220px, 100%); height: auto; aspect-ratio: 1; margin: 12px auto 0; border-radius: 8px; background: #fff }
.about-area{
  gap: 18px;
  display: flex;
  flex-direction: column;
}

.announcement-history {
  color: var(--text-muted);
  font-size: 14px
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
  margin: 0 2px 4px;
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

.override-open-button {
  width: 100%;
  padding: 11px 15px;
  border: 0;
  border-radius: 14px;
  color: var(--text);
  background: var(--surface-subtle);
  cursor: pointer;
}

.override-list {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.override-list li {
  display: grid;
  gap: 5px;
  padding: 12px;
  border-radius: 8px;
  color: var(--text-muted);
  background: var(--surface-subtle);
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.override-list strong {
  color: var(--text-strong);
  font-size: 14px;
  font-weight: 650;
}
</style>
