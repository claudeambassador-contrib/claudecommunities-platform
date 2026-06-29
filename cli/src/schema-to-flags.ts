import { Command, Option } from 'commander'
import type { CommandMapping } from './command-map.js'

interface JsonSchemaProp {
  type?: string | string[]
  description?: string
  enum?: unknown[]
  minimum?: number
  maximum?: number
  default?: unknown
}

interface JsonSchema {
  type?: string
  properties?: Record<string, JsonSchemaProp>
  required?: string[]
  additionalProperties?: boolean
}

export interface SchemaApplication {
  /**
   * Convert commander's action callback arguments back into the tool's
   * argument object.
   *
   * Commander invokes actions as `(positional1, ..., positionalN, opts, command)`.
   * Pass the full `arguments` array to this function — it slices out positional
   * values, applies type coercion, and merges them with the option flags.
   */
  buildArgs: (commanderArgs: unknown[]) => Record<string, unknown>
  /** Count of positional args, for slicing the commander callback args. */
  positionalCount: number
}

/**
 * Attach commander options (and optional positional arguments) to `cmd`
 * derived from a JSON Schema. The optional mapping lets a command tweak
 * presentation — positional ordering, short flags, flag renames — without
 * touching the schema itself.
 */
export function applyToolSchema(
  cmd: Command,
  schema: JsonSchema | undefined,
  mapping?: CommandMapping,
): SchemaApplication {
  const props = schema?.properties ?? {}
  const required = new Set(schema?.required ?? [])
  const positional = mapping?.positional ?? []
  const shortFlags = mapping?.shortFlags ?? {}
  const rename = mapping?.rename ?? {}

  // Validate positional refs.
  for (const name of positional) {
    if (!(name in props)) {
      throw new Error(`Mapping for ${cmd.name()} declares positional "${name}" but it's not in the tool schema`)
    }
  }

  // 1. Positional arguments — declared in the order the user types them.
  for (const propName of positional) {
    const prop = props[propName]
    const isRequired = required.has(propName)
    const displayName = rename[propName] ?? propName
    const display = isRequired ? `<${displayName}>` : `[${displayName}]`
    cmd.argument(display, prop?.description ?? '')
  }

  // 2. Flags for everything else. Key the result map by the camelCase form
  //    commander uses to look up its parsed opts.
  type PropInfo = { schemaProp: string; type: string }
  const flagKeyToProp = new Map<string, PropInfo>()

  for (const [schemaName, prop] of Object.entries(props)) {
    if (positional.includes(schemaName)) continue

    const finalName = rename[schemaName] ?? schemaName
    const flagLong = kebab(finalName)
    const short = shortFlags[schemaName]
    const flagSpec = short ? `-${short}, --${flagLong}` : `--${flagLong}`
    const type = normalizeType(prop.type)
    const description = prop.description || ''
    const isRequired = required.has(schemaName)

    if (type === 'boolean') {
      cmd.addOption(new Option(flagSpec, description).default(undefined))
      cmd.addOption(new Option(`--no-${flagLong}`, `disable ${flagLong}`).default(undefined))
    } else {
      const valueName = finalName
      const argSlot = isRequired ? `<${valueName}>` : `[${valueName}]`
      const opt = new Option(`${flagSpec} ${argSlot}`, description)
      if (prop.enum && prop.enum.every((v) => typeof v === 'string')) {
        opt.choices(prop.enum as string[])
      }
      if (isRequired) opt.makeOptionMandatory(true)
      cmd.addOption(opt)
    }
    flagKeyToProp.set(camelCase(finalName), { schemaProp: schemaName, type })
  }

  return {
    positionalCount: positional.length,
    buildArgs(commanderArgs) {
      // commander action signature: (positional1, ..., positionalN, opts, Command)
      const positionalValues = commanderArgs.slice(0, positional.length)
      const opts = (commanderArgs[positional.length] as Record<string, unknown>) ?? {}

      const out: Record<string, unknown> = {}

      // Apply positional values first.
      positional.forEach((schemaName, i) => {
        const raw = positionalValues[i]
        if (raw === undefined) return
        out[schemaName] = coerce(raw, normalizeType(props[schemaName]?.type))
      })

      // Then flags.
      for (const [key, info] of flagKeyToProp) {
        const raw = opts[key]
        if (raw === undefined) continue
        out[info.schemaProp] = coerce(raw, info.type)
      }

      return out
    },
  }
}

function normalizeType(t: string | string[] | undefined): string {
  if (Array.isArray(t)) return t.find((x) => x !== 'null') ?? 'string'
  return t ?? 'string'
}

function coerce(value: unknown, type: string): unknown {
  if (value === undefined || value === null) return value
  switch (type) {
    case 'number':
    case 'integer': {
      const n = Number(value)
      if (Number.isNaN(n)) throw new Error(`Expected a number, got "${String(value)}"`)
      return type === 'integer' ? Math.trunc(n) : n
    }
    case 'boolean':
      if (typeof value === 'boolean') return value
      return /^(true|1|yes)$/i.test(String(value))
    default:
      return String(value)
  }
}

function kebab(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/_/g, '-').toLowerCase()
}

function camelCase(s: string): string {
  return s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())
}
