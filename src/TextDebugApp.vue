<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { ArrowLeft, Clipboard, RotateCcw } from 'lucide-vue-next'
import FittedText from '@/components/FittedText.vue'
import {
  inspectTextLayout,
  logTextLayoutCandidateDebug,
  serializeTextLayoutCandidateDebug,
} from '@/textLayout'

const text = ref('Algorithms and data structures')
const width = ref(72)
const maxSize = ref(20)
const spacingCap = ref(1)
const viewportWidth = ref(typeof window === 'undefined' ? 390 : window.innerWidth)
let resizeStartX = 0
let resizeStartWidth = 0

const layout = computed(() => inspectTextLayout({
  text: text.value,
  width: width.value,
  fontFamily: "'Source Han Sans SC VF', sans-serif",
  maxSize: maxSize.value,
  spacingCap: spacingCap.value,
  role: 'debug',
  viewportWidth: viewportWidth.value,
}))
const activeCandidateId = ref<string | null>(null)
const activeCandidate = computed(() => layout.value.candidates.find(
  (candidate) => candidate.id === activeCandidateId.value,
) ?? layout.value.selected)
const tileWidth = computed(() => layout.value.effectiveComfort.contentWidth)
const copiedCandidateId = ref<string | null>(null)

watch([text, width, maxSize, spacingCap], () => {
  activeCandidateId.value = null
  copiedCandidateId.value = null
}, { flush: 'sync' })

function reset() {
  text.value = 'Algorithms and data structures'
  width.value = 72
  maxSize.value = 20
  spacingCap.value = 1
}

function startResize(event: PointerEvent) {
  resizeStartX = event.clientX
  resizeStartWidth = width.value
  window.addEventListener('pointermove', resizeTile)
  window.addEventListener('pointerup', stopResize, { once: true })
}

function resizeTile(event: PointerEvent) {
  width.value = Math.min(700, Math.max(28, Math.round(resizeStartWidth + event.clientX - resizeStartX)))
}

function stopResize() {
  window.removeEventListener('pointermove', resizeTile)
}

function chooseCandidate(id: string) {
  activeCandidateId.value = id === layout.value.selected.id ? null : id
}

async function copyCandidateLog(id: string) {
  const log = serializeTextLayoutCandidateDebug(layout.value, id)
  logTextLayoutCandidateDebug(layout.value, id)
  try {
    await navigator.clipboard.writeText(log)
  } catch {
    const element = document.createElement('textarea')
    element.value = log
    element.style.position = 'fixed'
    element.style.opacity = '0'
    document.body.appendChild(element)
    element.select()
    document.execCommand('copy')
    element.remove()
  }

  copiedCandidateId.value = id
  window.setTimeout(() => {
    if (copiedCandidateId.value === id) copiedCandidateId.value = null
  }, 1400)
}

onUnmounted(stopResize)

function format(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : '-'
}
</script>

<template>
  <main class="debug-shell">
    <header class="debug-header">
      <div>
        <a class="debug-back" href="/"><ArrowLeft :size="16" /> 返回课程表</a>
        <h1>文字排版调试</h1>
      </div>
      <button class="icon-button" type="button" title="恢复示例" aria-label="恢复示例" @click="reset"><RotateCcw :size="17" /></button>
    </header>

    <section class="debug-stage">
      <div class="debug-tile-wrap">
        <div
          class="debug-cell"
          :class="{ 'has-padding': layout.comfort.paddingEligible }"
          :style="{ width: `${width}px`, paddingInline: `${layout.comfort.padding}px` }"
        >
          <div class="debug-tile" :style="{ width: `${tileWidth}px` }">
            <FittedText :text="text" :max-size="maxSize" :spacing-cap="spacingCap" role="debug" :candidate="activeCandidate" />
          </div>
          <span class="debug-resize-handle" role="separator" aria-label="拖动调整单元格宽度" @pointerdown.prevent="startResize" />
        </div>
      </div>
      <div class="debug-controls">
        <label>
          <span>单元格宽度 <strong>{{ width }}px</strong></span>
          <input v-model.number="width" type="range" min="28" max="700" step="1" />
        </label>
        <label>
          <span>测试文本</span>
          <textarea v-model="text" rows="3" spellcheck="false" />
        </label>
        <div class="debug-number-fields">
          <label><span>参考字号</span><input v-model.number="maxSize" type="number" min="4" max="80" step="0.5" /></label>
          <label><span>字距上限</span><input v-model.number="spacingCap" type="number" min="0" max="5" step="0.25" /></label>
        </div>
      </div>
    </section>

    <section class="debug-panel">
      <div class="debug-panel-heading">
        <div><h2>当前宽度</h2><p>{{ width }}px · 第 {{ layout.iterations }} 轮收敛 · 当前 {{ activeCandidate.id }} · 共 {{ layout.candidates.length }} 个候选</p></div>
        <div class="debug-score">{{ format(activeCandidate.score) }}</div>
      </div>
      <div class="comfort-grid">
        <div><span>推荐小</span><strong>{{ format(layout.comfort.minimum) }}px</strong></div>
        <div class="is-ideal"><span>推荐适合</span><strong>{{ format(layout.comfort.ideal) }}px</strong></div>
        <div><span>推荐大</span><strong>{{ format(layout.comfort.maximum) }}px</strong></div>
        <div><span>内容宽度</span><strong>{{ format(layout.comfort.contentWidth) }}px</strong></div>
      </div>
      <p class="debug-note">
        padding {{ layout.comfort.paddingEligible ? `已启用 ${format(layout.comfort.padding)}px × 2` : `未启用（${format(layout.comfort.paddingThreshold)}px 后启用）` }}；
        最低横向比例 0.80；推荐区间只参与评分，不是硬限制；最终评分区间适合值 {{ format(layout.effectiveComfort.ideal) }}px。
      </p>
    </section>

    <section class="debug-panel">
      <div class="debug-panel-heading">
        <div><h2>全部候选方案</h2><p>点击方案主体切换上方瓷砖；右侧按钮只复制这一项日志</p></div>
      </div>
      <div class="candidate-list">
        <article
          v-for="candidate in layout.candidates"
          :key="candidate.id"
          class="candidate"
          :class="{ selected: candidate.id === activeCandidate.id }"
        >
          <div class="candidate-select" @click="chooseCandidate(candidate.id)">
            <div class="candidate-heading">
              <strong>{{ candidate.id }} · {{ candidate.id === layout.selected.id ? '最优 · ' : '' }}{{ candidate.source === 'hard-break' ? '含词内断行' : '普通断行' }}</strong>
              <b>{{ format(candidate.score) }}</b>
            </div>
            <div class="candidate-lines">
              <span v-for="line in candidate.lines" :key="line.text + line.fontSize" class="candidate-line">{{ line.text }}</span>
            </div>
            <div class="candidate-meta">
              基准字号 {{ format(candidate.baseSize) }} · 字重迭代 {{ candidate.weightIterations }} 轮 ·
              字号 {{ candidate.lines.map((line) => `${format(line.fontSize)}px`).join(' / ') }} ·
              字重 {{ candidate.lines.map((line) => `${line.fontWeight}（绝对${line.absoluteWeight}，相对${line.relativeWeight >= 0 ? '+' : ''}${line.relativeWeight}，笔画${format(line.strokeThickness)}/${format(line.targetStroke)}）`).join(' / ') }} ·
              字距 {{ candidate.lines.map((line) => format(line.letterSpacing)).join(' / ') }} ·
              scaleX {{ candidate.lines.map((line) => format(line.scaleX)).join(' / ') }} ·
              overflow {{ candidate.lines.some((line) => line.overflow) ? '是' : '否' }}
            </div>
            <div class="candidate-breakdown">
              <span>字号 {{ format(candidate.breakdown.size) }}</span>
              <span>行数 {{ format(candidate.breakdown.lines) }}</span>
              <span>均衡 {{ format(candidate.breakdown.balance) }}</span>
              <span>字重 {{ format(candidate.breakdown.weight) }}</span>
              <span>可读 {{ format(candidate.breakdown.readability) }}</span>
              <span>原生 {{ format(candidate.breakdown.naturalText) }}</span>
              <span>变形 {{ format(candidate.breakdown.transform) }}</span>
              <span>断词 {{ format(candidate.breakdown.breaks) }}</span>
            </div>
            <div class="candidate-penalties">
              <span v-if="!candidate.breakdown.penalties.length">无扣分</span>
              <span v-for="penalty in candidate.breakdown.penalties" :key="penalty.key">
                {{ penalty.label }} -{{ format(penalty.points) }}：{{ penalty.reason }}
              </span>
            </div>
            <div class="candidate-line-details">
              <span v-for="(detail, lineIndex) in candidate.breakdown.linesDetail" :key="`${candidate.id}-${lineIndex}`">
                第{{ lineIndex + 1 }}行「{{ detail.text }}」：{{ detail.characterCount }}字，均衡 {{ format(detail.balanceRatio) }}，局部扣分 {{ detail.penalties.map((item) => `${item.label} -${format(item.points)}`).join('；') || '无' }}
              </span>
            </div>
          </div>
          <button class="candidate-copy" type="button" :title="copiedCandidateId === candidate.id ? '已复制' : '复制这一项日志'" :aria-label="copiedCandidateId === candidate.id ? '已复制' : '复制这一项日志'" @click.stop="copyCandidateLog(candidate.id)">
            <Clipboard :size="15" />
          </button>
        </article>
      </div>
    </section>
  </main>
</template>
