import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { getBeadboxRegistryPath } from "./workspace-registry"

const warnedPaths = new Set<string>()

export function getAppConfigPath(): string {
  return join(dirname(getBeadboxRegistryPath()), "config.json")
}

function warnOnce(path: string, reason: string): void {
  if (warnedPaths.has(path)) return
  warnedPaths.add(path)
  console.warn(`[beadbox-config] ${path}: ${reason}; bd serve reads disabled`)
}

/** Optional read pilot. The environment variable remains an explicit override. */
export async function bdServeReadsEnabled(): Promise<boolean> {
  if (process.env.BEADBOX_BD_SERVE_READS === "1") return true
  if (process.env.BEADBOX_BD_SERVE_READS === "0") return false

  const path = getAppConfigPath()
  let raw: string
  try {
    raw = await readFile(path, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false
    warnOnce(path, "cannot read config")
    return false
  }

  try {
    const config: unknown = JSON.parse(raw)
    if (config && typeof config === "object" && !Array.isArray(config)) {
      const enabled = (config as Record<string, unknown>).bdServeReads
      if (enabled === undefined) return false
      if (typeof enabled === "boolean") return enabled
    }
  } catch {
    // Invalid JSON is handled like an invalid setting below.
  }
  warnOnce(path, "invalid bdServeReads setting")
  return false
}
