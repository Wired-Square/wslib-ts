# wslib-ts

Shared TypeScript packages for Wired Square projects, published to the
Forgejo npm registry under `@wired-square` (never npmjs.org). `README.md`
covers using and publishing them.

## Layout

- npm workspaces: `packages/*` are the published packages, and
  `fixtures/consumer` is a test app built against the packed kit. MIT.
- Each package keeps its own `version`; nothing is lockstep. One root
  `CHANGELOG.md` holds a section per package.
- `scripts/` holds the gates, the release and the mirror; repo tooling needs
  Node 22.18 or later.
- The kit, appliance-ui and the canvas ship TSX source behind a `solid`
  export condition. The kit's and the canvas's `./core`, the canvas's
  `./react`, appliance-ui's `./vite`, tokens, mcp-bridge, appliance-types and
  chart compile to `dist/`.

## Gates

- `scripts/ci.sh` is the CI, and the pre-push hook runs it
  (`git config core.hooksPath scripts/hooks`). It checks the lockfile, commit
  messages, dossier links and the packages' declared dependencies, then runs
  `npm run check`.
- `npm run check` builds, runs the gates (forbidden names, no colour literal
  outside `theme.css` and the token values, `theme.css` as
  `scripts/theme-css.mjs` writes it), the typecheck, the tests, and the
  consumer fixture.
- `scripts/ci.sh --tag` adds `npm run floor`: the tests and the fixture at
  the oldest versions the peer ranges claim. It needs the network. A release
  runs it first.
- The generated `wslib-appliance-types` TypeScript is exported here at each
  `wslib-appliance-types-v<version>` tag, with the output folder cleared
  first. Its drift check against the pinned tag needs cargo, so it runs in
  GitHub Actions, and only when its inputs change; its no-`bigint` check is
  in the fast suite.

## Rules

- Australian English everywhere, identifiers included: colour, behaviour,
  serialise, licence.
- No consumer is named in the tree or in a commit message
  (`scripts/forbidden-names.txt`; the gates and ci.sh enforce it). State the
  constraint, not who has it.
- No links into the project's notes (`[[...]]`; ci.sh enforces it). Say what
  the code needs in the code.
- Comments only for what the code cannot say: a non-obvious why, an
  invariant, an external spec. Public docs are one sentence unless the
  contract is subtle.
- A dependency earns its place: security-critical code, a spec we would
  otherwise track, a platform binding, the ecosystem's foundation, or more
  than an afternoon's work. Otherwise write it. The packages have no runtime
  `dependencies`, only peers, except appliance-ui's `uqr`, a QR encoder.
  The canvas's peers, solid-js, react and react-dom, are optional, so
  `./core` alone needs nothing.
- No component names a colour; every value it draws is an `--app-*` token.
  A new token or export arrives only with the component that needs it.
- When a name moves between packages, the old home re-exports it for one
  release, or the release ships a migration note listing every moved name.
- A new package is trialled before its first publish: one consumer adopts it
  through `file:` or `link:` on a branch and reports back. That reference
  never merges.
- Consumers resolve `@wired-square` through `mirror.wiredsquare.com/npm/`.
  Forgejo drops `peerDependenciesMeta`, so a lockfile resolved from it records
  optional peers as required; the mirror restores them.

## Changes and releases

- Work goes on a branch and lands through a squash-merged PR.
- Commit messages: an imperative subject under about 70 characters, and a body
  only when the why needs one.
- The version bump and its `CHANGELOG.md` heading move in the PR. The heading
  is the version itself, with no "unreleased" marker. A new package starts at
  0.1.0.
- A release runs from `main` after the merge, and only for the packages named;
  nothing is released because it happens to be unreleased. `main` may run
  ahead of the registry.
- Every published version has its tag `<package>-v<version>` on `main`.
  `scripts/release.sh <package>... --execute` runs `ci.sh --tag`, signs and
  pushes the tags, and only then publishes and mirrors.
