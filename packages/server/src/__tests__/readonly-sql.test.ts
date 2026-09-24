import { afterEach, expect, test } from "bun:test"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  __resetBdPathCache,
  deleteComment,
  getAllBlocksDependencies,
  getChangedBeadIds,
  getDataFingerprint,
} from "../lib/bd"

const originalBdPath = process.env.BD_PATH
let root: string | undefined

afterEach(async () => {
  if (originalBdPath === undefined) delete process.env.BD_PATH
  else process.env.BD_PATH = originalBdPath
  __resetBdPathCache()
  if (root) await rm(root, { recursive: true, force: true })
  root = undefined
})

test("read-only SQL calls succeed while comment deletion remains writable", async () => {
  root = await mkdtemp(join(tmpdir(), "beadbox-readonly-sql-"))
  const beadsDir = join(root, ".beads")
  await mkdir(beadsDir)
  await writeFile(join(beadsDir, "metadata.json"), JSON.stringify({ dolt_mode: "server" }))
  const bdPath = join(root, "bd")
  await writeFile(
    bdPath,
    `#!/bin/sh
case "$*" in
  *"DELETE FROM comments"*)
    case " $* " in *" --readonly "*) exit 11 ;; esac
    exit 0 ;;
esac
case " $* " in *" --readonly "*) ;; *) exit 12 ;; esac
case "$*" in
  *"HASHOF"*) echo '[{"h":"head-a","i":"2026-01-01","c":0}]' ;;
  *"updated_at >"*) echo '[{"id":"task-a"}]' ;;
  *"FROM dependencies"*) echo '[{"issue_id":"task-a","depends_on_id":"task-b"}]' ;;
  *) exit 13 ;;
esac
`,
    { mode: 0o700 },
  )
  process.env.BD_PATH = bdPath
  __resetBdPathCache()

  expect(await getDataFingerprint({ db: beadsDir })).toContain("head-a")
  expect(await getChangedBeadIds("2026-01-01T00:00:00Z", { db: beadsDir })).toEqual(["task-a"])
  expect((await getAllBlocksDependencies({ db: beadsDir })).get("task-a")).toEqual(["task-b"])
  await expect(deleteComment(42, { db: beadsDir })).resolves.toBeUndefined()
})
