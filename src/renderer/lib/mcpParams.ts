export type ParamPathSegment = string | number

export interface FlatParamPath {
  path: string
  segments: ParamPathSegment[]
  depth: number
  valueType: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null' | 'unknown'
}

function getValueType(value: unknown): FlatParamPath['valueType'] {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'object') return 'object'
  if (typeof value === 'string') return 'string'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  return 'unknown'
}

function segmentToString(seg: ParamPathSegment): string {
  return typeof seg === 'number' ? `[${seg}]` : seg
}

export function pathToString(segments: ParamPathSegment[]): string {
  if (segments.length === 0) return ''
  return segments.reduce<string>((acc, seg, i) => {
    if (typeof seg === 'number') return `${acc}[${seg}]`
    return i === 0 ? seg : `${acc}.${seg}`
  }, '')
}

export function parsePath(path: string): ParamPathSegment[] {
  const segments: ParamPathSegment[] = []
  const regex = /([^.\[\]]+)|\[(\d+)\]/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(path)) !== null) {
    if (match[1] !== undefined) segments.push(match[1])
    else if (match[2] !== undefined) segments.push(Number(match[2]))
  }
  return segments
}

export function getValueAtPath(obj: Record<string, unknown>, path: string): unknown {
  const segments = parsePath(path)
  let current: unknown = obj
  for (const seg of segments) {
    if (current === null || current === undefined) return undefined
    if (typeof seg === 'number' && Array.isArray(current)) {
      current = current[seg]
    } else if (typeof seg === 'string' && typeof current === 'object' && !Array.isArray(current)) {
      current = (current as Record<string, unknown>)[seg]
    } else {
      return undefined
    }
  }
  return current
}

export function setValueAtPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const segments = parsePath(path)
  if (segments.length === 0) return obj

  const result = structuredClone(obj) as Record<string, unknown>
  let current: unknown = result

  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]
    const nextSeg = segments[i + 1]

    if (typeof seg === 'number' && Array.isArray(current)) {
      if (current[seg] === undefined) {
        current[seg] = typeof nextSeg === 'number' ? [] : {}
      }
      current = current[seg]
    } else if (typeof seg === 'string' && typeof current === 'object' && current !== null) {
      const record = current as Record<string, unknown>
      if (record[seg] === undefined) {
        record[seg] = typeof nextSeg === 'number' ? [] : {}
      }
      current = record[seg]
    }
  }

  const last = segments[segments.length - 1]
  if (typeof last === 'number' && Array.isArray(current)) {
    current[last] = value
  } else if (typeof last === 'string' && typeof current === 'object' && current !== null) {
    ;(current as Record<string, unknown>)[last] = value
  }

  return result
}

export function deleteAtPath(obj: Record<string, unknown>, path: string): Record<string, unknown> {
  const segments = parsePath(path)
  if (segments.length === 0) return obj

  const result = structuredClone(obj) as Record<string, unknown>
  let current: unknown = result

  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]
    if (typeof seg === 'number' && Array.isArray(current)) current = current[seg]
    else if (typeof seg === 'string' && typeof current === 'object' && current !== null) {
      current = (current as Record<string, unknown>)[seg]
    } else {
      return result
    }
  }

  const last = segments[segments.length - 1]
  if (typeof last === 'number' && Array.isArray(current)) {
    current.splice(last, 1)
  } else if (typeof last === 'string' && typeof current === 'object' && current !== null) {
    delete (current as Record<string, unknown>)[last]
  }

  return result
}

function flattenValue(
  value: unknown,
  segments: ParamPathSegment[],
  depth: number,
  results: FlatParamPath[]
): void {
  const path = pathToString(segments)
  const valueType = getValueType(value)

  results.push({ path, segments, depth, valueType })

  if (valueType === 'object' && value !== null) {
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      flattenValue((value as Record<string, unknown>)[key], [...segments, key], depth + 1, results)
    }
  } else if (valueType === 'array') {
    ;(value as unknown[]).forEach((item, index) => {
      flattenValue(item, [...segments, index], depth + 1, results)
    })
  }
}

export function flattenParamPaths(params: Record<string, unknown>): FlatParamPath[] {
  const results: FlatParamPath[] = []
  const knownKeys = ['command', 'args', 'env', 'headers', 'url', 'type', 'cwd']

  for (const key of knownKeys) {
    if (key in params) {
      flattenValue(params[key], [key], 0, results)
    }
  }

  for (const key of Object.keys(params).sort()) {
    if (!knownKeys.includes(key)) {
      flattenValue(params[key], [key], 0, results)
    }
  }

  return results
}

export function formatPathLabel(entry: FlatParamPath): string {
  return `${'  '.repeat(entry.depth)}${segmentToString(entry.segments[entry.segments.length - 1] ?? '')}`
}
