export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function expectRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${path} 应为对象`)
  return value
}

export function expectArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${path} 应为数组`)
  return value
}

export function expectString(value: unknown, path: string): string {
  if (typeof value !== 'string') throw new Error(`${path} 应为字符串`)
  return value
}

export function expectNullableString(value: unknown, path: string): string | null {
  if (value === null) return null
  return expectString(value, path)
}

export function expectNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${path} 应为有效数字`)
  return value
}

export function expectInteger(value: unknown, path: string): number {
  const number = expectNumber(value, path)
  if (!Number.isInteger(number)) throw new Error(`${path} 应为整数`)
  return number
}

export function expectIntegerRange(value: unknown, path: string, minimum: number, maximum: number): number {
  const number = expectInteger(value, path)
  if (number < minimum || number > maximum) throw new Error(`${path} 应在 ${minimum} 至 ${maximum} 之间`)
  return number
}

export function expectBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${path} 应为布尔值`)
  return value
}

export function expectStringArray(value: unknown, path: string): string[] {
  return expectArray(value, path).map((item, index) => expectString(item, `${path}[${index}]`))
}
