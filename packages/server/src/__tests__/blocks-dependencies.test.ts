import { afterEach, expect, test } from "bun:test"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { __resetBdPathCache, getAllBlocksDependencies } from "../lib/bd"

const originalBdPath = process.env.BD_PATH
let root: string | undefined

afterEach(async () => {
  if (originalBdPath === undefined) delete process.env.BD_PATH
  else process.env.BD_PATH = originalBdPath
  __resetBdPathCache()
  if (root) await rm(root, { recursive: true, force: true })
  root = undefined
})

test("server mode returns a task's blockers from the Beads dependency schema", async () => {
  root = await mkdtemp(join(tmpdir(), "beadbox-blocks-"))
  const beadsDir = join(root, ".beads")
  await mkdir(beadsDir)
  await writeFile(join(beadsDir, "metadata.json"), JSON.stringify({ dolt_mode: "server" }))

  // The fake SQL endpoint models the current Beads schema: the old column
  // name is rejected exactly as Dolt rejects it, while the public result
  // remains the issue -> blocker mapping consumed by the UI.
  const bdPath = join(root, "bd")
  await writeFile(
    bdPath,
    '#!/bin/sh\ncase "$*" in\n  *depends_on_issue_id*) printf \'[{"issue_id":"task-a","depends_on_id":"task-b"}]\\n\' ;;\n  *) echo "Unknown column depends_on_id" >&2; exit 1 ;;\nesac\n',
    { mode: 0o700 },
  )
  process.env.BD_PATH = bdPath
  __resetBdPathCache()

  const blockers = await getAllBlocksDependencies({ db: beadsDir })
  expect(blockers.get("task-a")).toEqual(["task-b"])
})
