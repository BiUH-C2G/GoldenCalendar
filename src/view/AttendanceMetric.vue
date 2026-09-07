<script setup lang="ts">
import type { attendanceMetric } from '@/Attendance'
defineProps<{ metric: ReturnType<typeof attendanceMetric>, label: string, description: string }>()
</script>

<template>
  <div class="attendance-metric" :data-level="metric.level" :title="description">
    <div class="metric-heading"><span>{{ label }}</span><span class="metric-status">{{ metric.label }}</span></div>
    <div class="metric-value"><strong>{{ metric.rate.toFixed(2).replace(/\.00$/, '.0') }}<small>%</small></strong><span>{{ metric.count }} / {{ metric.total }} 节</span></div>
    <div class="metric-track" role="progressbar" :aria-label="`${label}缺勤率`" :aria-valuenow="metric.rate" :aria-valuemin="0" :aria-valuemax="100" :aria-valuetext="`${metric.rate.toFixed(2)}%，须低于30%`"><div class="metric-allowance"/><div class="metric-fill" :style="{ width: `${Math.min(100, Math.max(0, metric.rate))}%` }"/><div class="metric-limit"/></div>
    <div class="metric-scale" aria-hidden="true"><span>0%</span><span class="metric-limit-label">30%</span><span>100%</span></div>
    <span class="metric-remaining">{{ metric.level === 'danger' ? `超出允许节数 ${metric.excess} 节` : `缺勤余量 ${metric.remaining} 节` }}</span>
  </div>
</template>

<style scoped>
.attendance-metric { min-width: 0; --metric-color: color-mix(in srgb, var(--text) 75%, var(--block-green)); --metric-allowance: color-mix(in srgb, var(--block-green) 85%, var(--text-muted)) }
.attendance-metric[data-level="warning"] { --metric-color: color-mix(in srgb, var(--text) 70%, var(--accent)) }
.attendance-metric[data-level="critical"] { --metric-color: var(--accent) }
.attendance-metric[data-level="danger"] { --metric-color: var(--danger) }
.metric-heading { display: grid; grid-template-rows: 17px 14px; gap: 3px; font-size: 12px; line-height: 17px; color: var(--text-muted) }
.metric-status { color: var(--metric-color); font-size: 11px; line-height: 14px }
.metric-value { display: grid; gap: 5px; margin-top: 8px; font-size: 11px; color: var(--text-muted); font-variant-numeric: tabular-nums }
.metric-value strong { font-family: var(--font-display); font-size: 26px; font-weight: 600; line-height: 1.2; color: var(--text-strong) }
.metric-value small { font-size: 12px; margin-left: 2px }
.metric-track { position: relative; height: 7px; background: var(--border-soft); margin-top: 12px }
.metric-allowance { position: absolute; inset: 0 auto 0 0; width: 30%; background: var(--metric-allowance) }
.metric-fill { position: absolute; top: 2px; bottom: 2px; left: 0; background: var(--metric-color) }
.metric-limit { position: absolute; top: -2px; bottom: -2px; left: 30%; width: 1px; background: var(--danger) }
.metric-scale { position: relative; display: flex; justify-content: space-between; height: 14px; margin: 4px 0 8px; font-size: 10px; line-height: 14px; color: var(--text-muted); font-variant-numeric: tabular-nums }
.metric-limit-label { position: absolute; left: 30%; transform: translateX(-50%); color: var(--danger) }
.metric-remaining { display: block; color: var(--metric-color); font-size: 11px; line-height: 1.6 }
</style>
