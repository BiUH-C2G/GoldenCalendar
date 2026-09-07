<script setup lang="ts">
import {ATTENDANCE_MODES} from '@/Attendance'
</script>

<template>
  <div class="attendance-rules">
    <section>
      <h3 class="dialog-group-title">统计基准</h3>
      <p>缺勤率 = 本口径缺勤节数 ÷ 全学期本课总节数，要求严格低于 30%。课表每个上课时段计一节，不拆分为学时</p>
    </section>
    <section v-for="mode in ATTENDANCE_MODES" :key="mode.key">
      <h3 class="dialog-group-title">{{ mode.label }}</h3>
      <p>{{ mode.description }}。{{ mode.key === 'conservative' ? '这是不利假设叠加的参考值，并非学校已确认的记法' : mode.key === 'daily' ? '整日仅限同一天、同一门课；可能涵盖当天尚未开始的节次' : mode.key === 'actual' ? '未记录不代表到场，漏记会使结果偏低' : '未计缺勤不代表已确认实际到场' }}</p>
    </section>
    <section>
      <h3 class="dialog-group-title">余量与提醒</h3>
      <dl class="risk-levels">
        <div>
          <dt>有余量</dt>
          <dd>还能增加至少 3 节</dd>
        </div>
        <div>
          <dt>需留意</dt>
          <dd>余量 1～2 节</dd>
        </div>
        <div>
          <dt>临界</dt>
          <dd>余量为零，但仍低于 30%</dd>
        </div>
        <div>
          <dt>已达线</dt>
          <dd>达到或超过 30%</dd>
        </div>
      </dl>
      <p>连带记法一次可能增加多节。节数判断使用未四舍五入的数值</p>
    </section>
    <section>
      <h3 class="dialog-group-title">待确认与未关联</h3>
      <p>逐节点名与整日连带基于已确认的点名缺勤。点名不清楚的节次单独标为待确认，不作为已确认缺勤</p>
      <p>未来时段不记为到场；调课或换班后未关联的记录保留，但不进入当前课表统计</p>
    </section>
  </div>
</template>

<style scoped>
.attendance-rules {
  display: grid;
  gap: 24px;
  min-width: 0;
  overflow-wrap: anywhere
}

.attendance-rules p {
  margin: 0 2px;
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.8
}

.attendance-rules p + p {
  margin-top: 12px
}

.risk-levels {
  display: grid;
  gap: 8px;
  margin: 0 0 12px
}

.risk-levels > div {
  display: grid;
  grid-template-columns: 68px minmax(0, 1fr);
  gap: 12px;
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--block-green);
  color: var(--text);
  font-size: 13px;
  line-height: 1.6
}

.risk-levels > div:nth-child(2) {
  background: var(--block-blue)
}

.risk-levels > div:nth-child(3) {
  background: var(--block-violet)
}

.risk-levels > div:nth-child(4) {
  background: var(--block-warm)
}

.risk-levels dt {
  color: var(--text-strong);
  font-weight: 600
}

.risk-levels dd {
  min-width: 0;
  margin: 0
}
</style>
