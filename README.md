# Cockpit Share Control

A [Cockpit](https://cockpit-project.org/) module for administering Samba shares
through a **declarative device-by-share access matrix**.

## The idea

Most share-management GUIs own the configuration: you edit in the interface, the
tool writes to a database or to Samba's `net conf` registry, and the resulting
policy is whatever the tool says it is. There is nothing to review, nothing to
diff, and nothing to put in version control.

Share Control inverts that. **A matrix file on disk is the source of truth** — a
small, human-readable table of *device × share → read/write/none*. The module is
a view and controller over that file:

1. it renders the matrix as an editable grid,
2. it writes your edits back to the matrix file,
3. it invokes the generator, which validates the rendered configuration with
   `testparm` and installs it only if that passes.

The generator is the single brain and keeps its own validation gate. The module
never reimplements that logic, and never becomes a second store of policy. If
the module is uninstalled, the matrix file and the generator remain a complete,
working console.

That inversion — the GUI serving a diffable file, rather than the file being an
export of the GUI's database — is the point of the project.

## Status

**Early development.** The scaffold is in place; the matrix view is not yet
implemented. Not usable yet.

## Requirements

- Cockpit 137 or newer
- Samba
- Node.js and `npm` for building

## Building and running against a live Cockpit

```sh
make                 # build into dist/
make devel-install   # symlink dist/ into ~/.local/share/cockpit/share-control
```

Then open Cockpit at <https://localhost:9090> and reload the page after each
build. `make watch` rebuilds on change.

To remove the development symlink:

```sh
make devel-uninstall
```

## Checks

```sh
make codecheck       # eslint + stylelint
```

## Provenance and licensing

Generated from [cockpit-project/starter-kit](https://github.com/cockpit-project/starter-kit)
(commit `a206d5a`, 2026-08-13), which is LGPL-2.1.

This project is **LGPL-2.1-or-later**, matching Cockpit and its ecosystem so
that code can move in both directions.

Borrowed code is tracked per piece, because the licence depends on it:

| Source | Licence | Use here |
|---|---|---|
| [cockpit-project/starter-kit](https://github.com/cockpit-project/starter-kit) | LGPL-2.1 | scaffold, build system, test harness |
| [cockpit-project/cockpit](https://github.com/cockpit-project/cockpit) (`pkg/lib`) | LGPL-2.1 | checked out at build time by the Makefile |
| [mietzen/smb-zfs](https://github.com/mietzen/smb-zfs) | MIT | reference for the CLI↔frontend JSON contract; archived 2025-08-19 |
| 45Drives (`cockpit-file-sharing`, `cockpit-identities`, `houston-common`) | **GPL-3.0** | **study only — must not be vendored** |

The last row is the constraint that matters: vendoring one GPL-3.0 file would
relicense this entire project. Read those for mechanism, write your own code.

## Licence

LGPL-2.1-or-later. See [LICENSE](LICENSE).
