# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Cockpit module for administering Samba shares from a **declarative
device-by-share access matrix**. Generated from `cockpit-project/starter-kit`
(commit `a206d5a`, 2026-08-13).

Status: scaffold only. `src/app.tsx` is still the template's placeholder that
displays the hostname. No matrix functionality exists yet.

## Commands

```sh
make                  # build into dist/  (requires a git repo — see below)
make watch            # rebuild on change
make devel-install    # symlink dist/ -> ~/.local/share/cockpit/share-control
make devel-uninstall  # remove that symlink
make codecheck        # eslint + stylelint (+ python linters if installed)
npm run eslint:fix    # autofix JS/TS
npm run stylelint:fix # autofix SCSS
```

After a build, reload the Cockpit page in the browser — there is no hot reload.
Cockpit runs at `https://localhost:9090`, bound to loopback deliberately.

Integration tests need a downloaded VM image and are slow:

```sh
make vm                                       # build the test VM (TEST_OS, default centos-9-stream)
make check                                    # run test/check-application against it
./test/check-application -l                   # list the tests that would run
./test/check-application -tv TestApplication.testBasic   # one test, traced
TEST_BROWSER=firefox ./test/check-application -tv        # browser is an env var, not a flag (default chromium)
```

`make codecheck` is the gate that matters for ordinary work; `make check` is
rarely worth running locally.

## Two ordering constraints that will waste your time

**`git init` must precede `make`.** The build checks out cockpit's `pkg/lib`,
`test/common` and `tools/node-modules` by running `git fetch` *into this working
tree* at a pinned commit (`COCKPIT_REPO_COMMIT` in the Makefile). In a
non-repository it fails with "Kein Git-Repository" / "not a git repository",
which does not obviously point at the real cause.

**`node_modules` is a btrfs subvolume**, created before the first `npm install`
so ~400 MB of regenerable churn stays out of `~/projects` snapshots. Do not
delete and recreate it as a plain directory — use `btrfs subvolume delete` and
`btrfs subvolume create` if it ever needs resetting.

## The naming chain — do not "fix" it

`package.json` says `"name": "share-control"`, **not** `cockpit-share-control`.
Everything else is derived:

```make
PACKAGE_NAME  := share-control                 # from package.json
RPM_NAME      := cockpit-$(PACKAGE_NAME)       # cockpit-share-control
APPSTREAMFILE  = io.github.1ausffm.$(subst -,_,$(PACKAGE_NAME)).metainfo.xml
install path   = $(PREFIX)/share/cockpit/$(PACKAGE_NAME)
```

So the installed module and its Cockpit URL are **`/share-control`**, while the
distro package is `cockpit-share-control`. Renaming the npm package to the full
name produces `cockpit-cockpit-share-control` in the RPM name, spec file,
tarballs and PKGBUILD.

The AppStream id was deliberately moved out of `org.cockpit_project.*` (a
namespace this project does not own) into `io.github.1ausffm.*`. The
`<extends>org.cockpit_project.cockpit</extends>` line is correct and must stay.

## Not our code

`pkg/`, `test/common/` and `tools/node-modules` are fetched from the cockpit
repository at build time and are gitignored. Never edit them — changes are lost
on the next checkout. To move to newer cockpit library code, bump
`COCKPIT_REPO_COMMIT` in the Makefile (the `.github/workflows/cockpit-lib-update.yml`
workflow does this automatically once the repo is on GitHub).

`package-lock.json` is gitignored, which is upstream starter-kit's convention
(their release model ships a separate node-cache tarball). Builds are therefore
not pinned.

## Licensing constraint on borrowed code

This project is **LGPL-2.1-or-later**, matching cockpit so code can move both
ways. That makes the following a hard rule rather than a preference:

- `cockpit-project/*` (LGPL-2.1) and `mietzen/smb-zfs` (MIT) — may be copied,
  with attribution recorded in the README's provenance table.
- **45Drives** (`cockpit-file-sharing`, `cockpit-identities`, `houston-common`)
  are **GPL-3.0 — study only.** Vendoring a single file relicenses this entire
  project. Read them for mechanism; write the code yourself.

Add a row to the README provenance table whenever code is borrowed.

## Intended architecture

This is the part not discoverable from the code, because the other half lives
outside this repository.

The design inverts the usual share-management GUI. **The matrix file on disk is
the source of truth** — not a database, and not Samba's `net conf` registry:

```
ausgpc-smb-matrix.toml   ← the only place policy is written (device × share → rw/ro/none)
        │
        ▼
   smb-matrix-gen        ← renders it, validates with testparm, installs it
        │
        ▼
/etc/samba/shares.conf   ← generated output; never hand-edited
```

This module is a **view and controller over that file**. Two rules follow, and
they are the project's identity:

1. **Never reimplement the generator.** The module invokes `smb-matrix-gen`
   through the cockpit bridge, the same way a shell would. The Python side stays
   the single brain; the TypeScript side is presentation. The `testparm`
   validation gate lives in the generator, once.
2. **Never become a second store of policy.** If this module is uninstalled, the
   matrix file plus the generator remain a complete, working console.

The planned read path follows `mietzen/smb-zfs`: one JSON-emitting command
(`get-state` there) that the frontend consumes, with mutation through imperative
subcommands. `smb-matrix-gen` will need a `--json` mode emitting the parsed
matrix, the rendered candidate and the installed diff.

Note that smb-zfs *keeps its own state* and syncs Samba to it — the same
inversion this project rejects. Borrow its seam, not its ownership model.

## Where the project context lives — read this at session start

The plan driving this work — milestones, open decisions, rejected alternatives,
and the reasoning behind every design choice above — lives **outside this
repository**, in the AUSGPC chronicles bundle:

- `~/chronicles/plans/ausgpc-cockpit-share-control.md` — **this module's
  governing plan.** Milestones, structure, naming, and the reasoning behind
  every design decision. **Extracted 2026-09-01** from the file-master plan's
  § Track B, which had outgrown being a section of another plan.
- `~/chronicles/meta/anti-cloud-one-copy-authority.md` — **the positioning this
  project is held against**, including a three-question decision test every
  proposed feature must answer.
- `~/chronicles/plans/ausgpc-smb-master.md` — the machine track this module
  administers. The **one-way rule** lives here: machine-side work never waits
  on this module.
- `~/chronicles/systems/ausgpc-smb-matrix.toml` — the live matrix this module edits
- `~/chronicles/tools/smb-matrix-gen` — the generator this module drives
- `~/chronicles/CLAUDE.md` — how that bundle expects to be worked in

**Read the governing plan before adding features or making architectural
decisions.** It holds decisions already reasoned through; code written without
it re-derives them or contradicts them.

**Two structural decisions already made, 2026-09-01 — do not re-litigate them
in code:**

- **One package, several menu entries** (cockpit's own `systemd` pattern), not
  a suite of packages. Each `menu` entry in `src/manifest.json` maps to
  `<name>.html` with its own bundle in `build.js`.
- **The package is `cockpit-share-control`; the GitHub repository is
  `anti-cloud`.** They differ deliberately — the thesis in the repo name and
  the README, a searchable functional name for the package.

**If those paths are unreachable, say so and stop guessing.** The bundle is
outside this working directory, so a session started without access to it cannot
see the design. In that case: report it plainly, and treat architectural
questions as blocked rather than answerable — do not infer an architecture from
the code in this repo and proceed. That inference looks like work and diverges
silently.

To grant access, launch with:

```sh
claude --add-dir ~/chronicles
```

`.claude/settings.local.json` carries the matching permission rules. It is
gitignored deliberately — it contains machine-specific paths and must not ship
to anyone who clones this repository.

The general arrangement, and why it is set up this way, is
`~/chronicles/meta/chronicle-project-cross-awareness.md`.
