# linux-anti-cloud

**Pre-alpha. One page works. Not usable as a product yet.** See [Status](#status)
before investing any time.

A [Cockpit](https://cockpit-project.org/) module that turns a Linux workstation
into the authoritative home for your own working files — reachable from the
devices you name, reversible in time, on a machine that is also your desktop and
therefore has to sleep.

The Cockpit package is called **`cockpit-share-control`**; this repository is
named for the idea behind it.

## What "anti-cloud" means

Dropbox, OneDrive and Nextcloud solve *"my files everywhere"* by **replicating**
your data onto a server, then spending their entire complexity budget
reconciling the copies.

This solves the same problem the other way round: keep **one copy**, on hardware
you own, and make it *reachable* and *reversible* instead.

**There are no sync conflicts because there is no second copy.** Your laptop is
a terminal onto the files, not a replica of them. Windows Explorer's *Previous
Versions* dialog is your undo, served straight from filesystem snapshots.

**The travelling client is the hard case, and it is not solved yet.** A laptop
that leaves the network cannot be a terminal onto files it can no longer reach,
and the honest options — check out a subtree and check it back in, or accept
being offline — are a design problem rather than a feature to switch on. It is
on the roadmap precisely because it is where the one-copy idea is under the most
pressure.

## What this is not

Stated plainly, because the name invites the wrong guesses:

- **Not remote access.** It serves your LAN. Exposing it to the internet is a
  decision this project does not make for you.
- **Not mobile.** SMB on phones is poor. Solving that means replicas, which is
  the thesis inverted.
- **Not file sharing with other people.** No links, no external identities, no
  multi-tenancy.
- **Not sync.** The absence of a second copy is the feature.
- **Not a NAS distribution.** TrueNAS and OpenMediaVault are excellent and this
  is not competing with them. They assume a *dedicated* machine.

## Who this is for

Someone running a **btrfs workstation that doubles as a part-time file server**
— and who has noticed that every NAS product assumes a machine that is always
on and does nothing else.

That assumption is where the interesting problems live: the machine must sleep,
must *not* sleep while someone is working in a share, roams between Wi-Fi
access points, and shares its snapshot substrate with the operating system.

## The inversion

Most share-management GUIs own the configuration: you edit in the interface, the
tool writes to a database or to Samba's `net conf` registry, and the resulting
policy is whatever the tool says it is. There is nothing to review, nothing to
diff, and nothing to put in version control.

This inverts that. **A matrix file on disk is the source of truth** — a small,
human-readable table of *device × share → read/write/none*. The module is a view
and controller over that file:

1. it renders the matrix as an editable grid,
2. it writes your edits back to the matrix file,
3. it invokes the generator, which validates the rendered configuration with
   `testparm` and installs it only if that passes.

The generator is the single brain and keeps its own validation gate. The module
never reimplements that logic and never becomes a second store of policy. **If
the module is uninstalled, the matrix file and the generator remain a complete,
working console.**

That inversion — the GUI serving a diffable file, rather than the file being an
export of the GUI's database — is the point of the project.

## Report drift, not configuration

A console that renders your *declared* configuration is blind to the failure
that actually bites: declared and running silently diverge, and **nothing
errors**. Samba resolves `interfaces =` to addresses once, at startup; an
address that appears later is skipped with one log line, while the unit stays
`active`, `testparm` stays clean, and the share is simply not there.

So this module's job is the **difference** between what you declared and what
the machine is doing.

## Status

| Page | State |
|---|---|
| **Suspend policy** | **works** — reads `logind` live: what is blocking sleep, who is holding it, why |
| Shares (the matrix grid) | not implemented — placeholder |
| Status (services, clients, binding drift) | not implemented |
| Snapshots | not implemented |

**The engine ships with the front end.** `cli/smb-matrix-gen` — the generator
that renders your matrix, validates it with `testparm`, and installs it only if
that passes — is in this repository, with an example matrix at
`cli/smb-matrix.example.toml`. It is usable on its own, without Cockpit:

```sh
cli/smb-matrix-gen --matrix cli/smb-matrix.example.toml --diff
```

It takes `--matrix FILE`, falling back to `$SMB_MATRIX` and then
`/etc/samba/smb-matrix.toml`.

**No releases, no packages, nothing announced.** It is developed in the open from
the first commit because that is how the author works, not because it is ready.
Issues and PRs are welcome but may sit; this serves one machine today.

## Requirements

- Python 3.11+ (for `cli/smb-matrix-gen`; `tomllib` is stdlib from 3.11)
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
