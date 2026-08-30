import { coordinateFile, dataContract, getGrade } from './contract'
import type { LanguageClass, ScheduleData, SelectedLanguageClasses, Selection } from './types'

const DATA_ROOT = `${import.meta.env.BASE_URL}data/${dataContract.term}/`

interface AdministrativePayload {
  calendar: ScheduleData['calendar']
  events: ScheduleData['group']['events']
  notices: ScheduleData['group']['notices']
}

async function loadCoordinate<T>(file: string, label: string): Promise<T> {
  const response = await fetch(`${DATA_ROOT}${file}`)
  if (!response.ok) throw new Error(`${label}加载失败（${response.status}）`)
  return response.json() as Promise<T>
}

export async function loadAdministrativeSchedule(selection: Selection): Promise<ScheduleData> {
  const major = getGrade(selection.grade)?.majors.find((item) => item.code === selection.majorCode)
  if (!major) throw new Error('行政班坐标无效')
  const payload = await loadCoordinate<AdministrativePayload>(
    coordinateFile('administrative', {
      grade: selection.grade,
      majorCode: selection.majorCode,
      groupId: selection.groupId,
    }),
    '行政班课程表',
  )
  return {
    source: {
      term: dataContract.term,
      grade: selection.grade,
      majorCode: selection.majorCode,
      major: major.name,
    },
    calendar: payload.calendar,
    group: {
      groupId: selection.groupId,
      events: payload.events,
      notices: payload.notices,
    },
  }
}

export async function loadSelectedLanguages(selection: Selection): Promise<SelectedLanguageClasses> {
  const grade = getGrade(selection.grade)
  if (!grade) throw new Error('年级坐标无效')
  const germanPromise = loadCoordinate<LanguageClass>(
    coordinateFile('german', {
      section: grade.germanSection,
      level: selection.germanLevel,
      classNumber: selection.germanClassNumber,
    }),
    '德语课程表',
  )
  const englishPromise = selection.englishClassNumber
    ? loadCoordinate<LanguageClass>(
        coordinateFile('english', { classNumber: selection.englishClassNumber }),
        '英语课程表',
      )
    : Promise.resolve(null)
  const catchupPromise = selection.englishCatchupEnabled && selection.englishCatchupClassNumber
    ? loadCoordinate<LanguageClass>(
        coordinateFile('englishCatchup', { classNumber: selection.englishCatchupClassNumber }),
        '英语补课课程表',
      )
    : Promise.resolve(null)

  const [english, englishCatchup, german] = await Promise.all([
    englishPromise,
    catchupPromise,
    germanPromise,
  ])
  return { english, englishCatchup, german }
}
