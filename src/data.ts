import type { Manifest, ScheduleData } from './types'

const DATA_ROOT = `${import.meta.env.BASE_URL}data/`

export async function loadManifest(): Promise<Manifest> {
  const response = await fetch(`${DATA_ROOT}manifest.json`)
  if (!response.ok) throw new Error(`加载数据索引失败（${response.status}）`)
  return response.json() as Promise<Manifest>
}

export async function loadSchedule(sourcePath: string): Promise<ScheduleData> {
  const response = await fetch(`${DATA_ROOT}${sourcePath}`)
  if (!response.ok) throw new Error(`加载课程表失败（${response.status}）`)
  return response.json() as Promise<ScheduleData>
}
