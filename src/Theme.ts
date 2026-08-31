import type { ThemePreference } from './Types'

export const THEME_STORAGE_KEY = 'campus-timetable-theme'
let fallbackThemeAnimation: Animation | null = null
let fallbackThemeTimer = 0
let fallbackThemeTarget: string | null = null

export function readThemePreference(): ThemePreference {
  const value = localStorage.getItem(THEME_STORAGE_KEY)
  return value === 'light' || value === 'dark' ? value : 'system'
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean) {
  return preference === 'system' ? systemPrefersDark ? 'dark' : 'light' : preference
}

export function applyThemePreference(preference: ThemePreference, systemPrefersDark: boolean) {
  const theme = resolveTheme(preference, systemPrefersDark)
  const apply = () => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#171817' : '#f2dfe2')
  }

  if (fallbackThemeTarget) {
    fallbackThemeAnimation?.cancel()
    window.clearTimeout(fallbackThemeTimer)
    fallbackThemeAnimation = null
    fallbackThemeTimer = 0
    fallbackThemeTarget = null
  }

  if (!document.documentElement.dataset.theme || document.documentElement.dataset.theme === theme || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    apply()
    return
  }

  if (document.startViewTransition) {
    document.startViewTransition(apply)
    return
  }

  fallbackThemeAnimation?.cancel()
  window.clearTimeout(fallbackThemeTimer)

  fallbackThemeTarget = theme
  fallbackThemeAnimation = document.body.animate([{ opacity: 1 }, { opacity: .58, offset: .4 }, { opacity: 1 }], { duration: 300, easing: 'ease-in-out' })
  fallbackThemeTimer = window.setTimeout(() => {
    fallbackThemeTimer = 0
    fallbackThemeTarget = null
    apply()
  }, 120)
}
