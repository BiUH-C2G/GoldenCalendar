<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { dismissAnnouncement, loadAnnouncements, readDismissedAnnouncements } from '@/Announcements'
import type { Announcement as AnnouncementData } from '@/Announcements'
import Dialog from './Dialog.vue'
import Announcement from './dialog-content/Announcement.vue'

const props = defineProps<{ enabled: boolean }>()
const emit = defineEmits<{ active: [value: boolean] }>()
const queue = ref<AnnouncementData[]>([])
const current = ref<AnnouncementData | null>(null)
const open = ref(false)
const error = ref('')
const controller = new AbortController()

function showNext() {
  if (!props.enabled || current.value) return
  const dismissed = readDismissedAnnouncements()
  while (queue.value.length) {
    const next = queue.value.shift()!
    if (dismissed.has(next.id)) continue
    current.value = next
    error.value = ''
    open.value = true
    emit('active', true)
    break
  }
}

function close(remember: boolean) {
  if (!open.value || !current.value) return
  if (remember) {
    try {
      dismissAnnouncement(current.value.id)
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '无法记住此选择'
      return
    }
  }
  open.value = false
}

function afterClose() {
  current.value = null
  emit('active', false)
  showNext()
}

watch(() => props.enabled, showNext)
onMounted(async () => {
  try {
    queue.value = await loadAnnouncements(controller.signal)
    if (!controller.signal.aborted) showNext()
  } catch (cause) {
    if (!controller.signal.aborted) console.warn('公告加载失败，已跳过公告展示', cause)
  }
})
onBeforeUnmount(() => controller.abort())
</script>

<template>
  <Dialog :open="open" :title="current?.title ?? '公告'" @update:open="close(false)" @closed="afterClose">
    <Announcement v-if="current" :date="current.id" :content="current.content"/>
    <p v-if="error" role="alert" class="announcement-error">{{ error }}</p>
    <template #actions><button class="secondary-button" type="button" @click="close(true)">不再显示</button><button class="primary-button" type="button" data-dialog-autofocus @click="close(false)">确定</button></template>
  </Dialog>
</template>

<style scoped>
.announcement-error { color: var(--danger); overflow-wrap: anywhere; font-size: 13px; line-height: 1.6 }
</style>
