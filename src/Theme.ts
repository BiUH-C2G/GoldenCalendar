import type { ThemePreference } from './Types'

export const THEME_STORAGE_KEY = 'campus-timetable-theme'

export function readThemePreference(): ThemePreference {
  const value = localStorage.getItem(THEME_STORAGE_KEY)
  return value === 'light' || value === 'dark' ? value : 'system'
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean) {
  return preference === 'system' ? systemPrefersDark ? 'dark' : 'light' : preference
}

export function applyThemePreference(preference: ThemePreference, systemPrefersDark: boolean) {
  const theme = resolveTheme(preference, systemPrefersDark)
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#171817' : '#f2dfe2')
}
