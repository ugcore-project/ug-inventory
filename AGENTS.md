# AGENTS.md

Instructions for AI coding agents (Claude Code, Codex, Cursor, Copilot, ...) working on `ug-inventory`.
Humans: read it too. It is the short version of every UgCore rule that matters when you change this resource.

When a rule here conflicts with habit or with other frameworks (QBCore, QBox, ESX, ox_lib), this file wins.

## What this is

A FiveM resource for the UgCore framework. Lua 5.4 on the game side, React + TypeScript for the optional NUI page.
Org: https://github.com/ugcore-project. Docs: https://ugcore.urging.ch. Default branch: `dev`.

The inventory screen. ug-core owns every item, container, weapon and shop, and checks every action on the server.
This resource only shows them and asks: it has no server callbacks, no database and no inventory logic. The server
side loads config and publishes stash positions. The client opens the screen with what is in reach, mirrors ug-core's
inventory to the page, and runs what the page asks through `UgCore.Inventory`, `UgCore.Weapons` and `UgCore.Shops`.

Keep it that way. A rule about items (weight, stacking, who may open what) belongs in ug-core, never here.

## Skills

Task-specific guides live in `skills/<name>/SKILL.md`. Read the matching one before you start the task.

| Skill | Use it when |
| --- | --- |
| `skills/nui-page` | Adding or changing the NUI page, its messages and its callbacks. |
| `skills/config` | Adding an owner config option. |
| `skills/testing` | Writing Lua or web tests, adding a mock. |
| `skills/readme-preview` | Changing a screen or a feature owners notice: README features and images. |
| `skills/ug-core-api` | Looking up what ug-core and ug-lib offer: namespaces, enums, events, hooks, error codes. |

## Documentation

https://ugcore.urging.ch is the published documentation for ug-core, ug-lib and the official resources. Read the
page before using an API you have not used yet. Pages are `https://ugcore.urging.ch/<path>`:

| Topic | Paths |
| --- | --- |
| Start | `introduction`, `quickstart`, `architecture`, `concepts/security`, `concepts/death-system` |
| Building resources | `developers/importing`, `developers/callbacks`, `developers/net-events`, `developers/schemas`, `developers/events`, `developers/hooks`, `developers/lifecycle`, `developers/statebags`, `developers/modules`, `developers/versioning` |
| ug-core API | `api/overview`, then `api/<namespace>`: `players`, `players-death`, `player`, `localplayer`, `characters`, `accounts`, `jobs`, `gangs`, `permissions`, `permissions-groups`, `identity`, `sessions`, `commands`, `needs`, `items`, `inventory`, `inventory-client`, `inventory-containers`, `shops`, `shops-client`, `weapons`, `weapons-client`, `callback`, `network`, `schema`, `ratelimit`, `guard`, `hooks`, `events`, `lifecycle`, `config`, `modules`, `logger`, `locale`, `version`, `enums` |
| Reference | `reference/error-codes`, `reference/events`, `reference/hooks`, `reference/statebags`, `reference/config-files`, `reference/convars` |
| ug-lib | `ug-lib/introduction`, `ug-lib/importing`, `ug-lib/with-ugcore`, `ug-lib/security`, then `ug-lib/<component>`: `notify`, `textui`, `progress`, `skillcheck`, `dialog`, `context`, `menu`, `radial`, `keybind`, `zone`, `npc`, `entity`, `streaming`, `animation`, `cache`, `raycast`, `draw`, `locale`, `format`, `math`, `string`, `table`, `async` |
| Server owners | `owners/configuration`, `owners/modules`, `owners/permissions`, `owners/guard`, `owners/database`, `owners/console`, `owners/troubleshooting` |
| Contributing | `contributing/overview`, `contributing/conventions`, `contributing/testing` |
| Official resources, as examples | `ug-hud/*`, `ug-target/*` (`server-actions`, `security`), `ug-appearance/*` (`security`, `integration`), `ug-multicharacter/*` |

The source wins when the docs and the code differ. Clone `ug-core` and `ug-lib` next to this repository: they are
also what the type check and the tests read.

## Ecosystem

- **ug-core**: headless, server-authoritative framework core. Players, characters, accounts, jobs, gangs, permissions,
  sessions, death state, callbacks, net events, schema validation, rate limits, Guard (anticheat scoring). No UI.
- **ug-lib**: UI components (notify, text UI, progress, dialogs, menus, context, radial) and pure utilities. No network,
  no state.
- **This resource**: a feature resource with a NUI page. It uses both.
- Runtime dependencies: OneSync, `ug-core` (with the `items` and `inventory` modules) and `ug-lib`. Nothing else.
- Never depend on `ox_lib`, `qb-core`, `es_extended` or any other framework. Compatibility layers are separate files
  that only export the foreign names.

Both are loaded through their imports in `fxmanifest.lua`:

```lua
shared_scripts {
    '@ug-core/import.lua', -- defines UgCore
    '@ug-lib/import.lua',  -- defines UgLib
    'shared/init.lua',     -- defines UgInventory, MUST come right after the imports
}
```

`ugcore_version` and `uglib_version` in the manifest make the imports refuse to start against older versions.

## Layout

```text
fxmanifest.lua             script order matters: each file MAY use what the files above defined; boot.lua is last
shared/init.lua            the only global: UgInventory, UgInventory.Internal
shared/enums.lua           every magic value: events, callback names, NUI actions and callbacks
shared/clothing.lua        clothing pieces: ped component or prop, ug-appearance key, drawable without the piece
server/config.default.lua  the defaults, with comments for owners; copied to config.lua on the first start, never overwritten
server/config.lua          loads, sandboxes and validates config.lua, publishes it in GlobalState
server/clothing.lua        items mode: pieces move between ug-appearance and the inventory, one change at a time
server/boot.lua            waits for ug-core Ready, loads config, publishes stash points
client/nui.lua             the page bridge: queue until ready, schema-checked callback bodies, rate budget
client/state.lua           mirrors ug-core's inventory to the page, toasts, the weapon in hand
client/sound.lua           game frontend sounds for the screen, its results and what the page asks
client/preview.lua         the character preview: a copy of the ped in an empty frontend menu, idling and reacting
client/wardrobe.lua        clothing slots read from the ped, toggle mode, take-off requests and animations
client/screen.lua          opens and closes the screen, runs page actions through ug-core
client/open.lua            the open key's target search, and the exports
client/hotbar.lua          slot keys, the quick-use wheel, the hidden GTA weapon wheel
client/drops.lua           local props at ground drops
client/boot.lua            waits for config and ug-core, registers keys, starts the client
images/                    item images owners add, sent to players
locales/*.json             every player-facing text; the `page` group goes to the NUI page
web/                       React + Vite + Tailwind 3 page, built to web/dist
tests/                     Lua 5.4 tests with native mocks, never shipped
.github/                   CI, release and repository checks
```

Split a file when it passes about 300 lines.

## Naming

| Thing | Style | Example |
| --- | --- | --- |
| Global | one, PascalCase | `UgInventory` |
| Public function | PascalCase | `UgInventory.Internal.Screen.Open` |
| Private code | `UgInventory.Internal.<Ns>` | `UgInventory.Internal.Config` |
| Local function | camelCase | `local function describeShop(name)` |
| Local constant | UPPER_SNAKE | `local STATE_KEY = 'ug-inventory:Config'` |
| Data field, option key | camelCase | `openKey` |
| Files, folders | lowercase | `client/screen.lua` |
| Events | `<resource>:<Name>` | `ug-inventory:Opened` |
| Statebag and GlobalState keys | `<resource>:<Key>` | `ug-inventory:Config` |
| NUI actions and callbacks | camelCase | `otherClosed`, `wheelPick` |
| Exports | PascalCase | `exports['ug-inventory']:OpenStash(name)` |

`ug-core:*` names belong to ug-core. Never emit, register or set them.

## Code style

- Every `.lua` file starts with the license header, then one blank line. Every `.ts`/`.tsx` under `web/src` too, as
  a `/* */` block. The repository check fails otherwise. Copy it from any existing file.
- Every Lua function has LuaLS annotations (`---@param`, `---@return`, `---@class`). They are not comments.
- Comments only where code needs clarification. Never narrate. Short sentences. RFC 2119 words for obligations.
- Namespaces are plain tables with a class. To define functions through a local, the local MUST be the class:

  ```lua
  ---@class UgInventory.Internal.Screen
  local Screen = {}
  UgInventory.Internal.Screen = Screen
  ```

- Magic values live in `UgInventory.Enums` (`---@enum`). Error codes come from `UgCore.Enums.Errors`, violations from
  `UgCore.Enums.Violations`, lifecycle states from `UgCore.Enums.Lifecycle`. Never write the string literal.
- Multiple returns keep one type per slot: `ok, value, errorCode`, never `ok, valueOrMessage`.
- A Lua table with a named field (`name = value`, `[key] = value`) puts one field per line, with a trailing comma.
  A list of plain values MAY stay on one line while it fits in 120 characters. A table inside a one-line block MAY stay inline.
- Cache natives and globals in locals only in hot paths (per tick, per request, per item).
- Natives take unpacked vectors: `GetDistance(coords.x, coords.y, coords.z)`. ug-core enables FXv2 OAL.
- Never depend on `pairs` order. Sort when order matters.
- Lua: 4 spaces, CRLF, 160 columns. Web: 2 spaces. See `.editorconfig`.

## Security: every client is hostile

These are not optional. Reviewers reject code that breaks them.

1. **Clients send intent, never results.** The page says "move slot 3 to slot 7, two units". ug-core decides whether
   it fits, weighs too much, or is out of reach. Never compute a price, a weight check or an outcome here and trust it.
   The page predicts moves for speed, and puts the slots back when ug-core refuses.
2. **Every server entry point has a schema and a rate limit.** Use `UgCore.Callback.Register` or
   `UgCore.Network.Register` with `schema = UgCore.Schema.Define({...})` and `rate = { max, per }`. Never call
   `RegisterNetEvent`, `RegisterServerEvent` or `TriggerServerEvent` yourself.
3. **Every input is bounded.** `String`, `Array` and `Map` rules MUST set `max`. Integers get `min` and `max`.
4. **Identity comes from `source` only.** Never read a player id or identifier from arguments.
5. **Positions are checked on the server** with `UgCore.Guard.IsNear(source, coords, maxDistance)`, plus a small margin.
6. **Report cheats** with `UgCore.Guard.Flag(source, UgCore.Enums.Violations.X, detail)`: `InvalidPayload` for
   requests a real client never sends, `OutOfRange` for distance. Guard scores and kicks.
7. **Never tell the client which check failed.** Reply with a generic error code (`no_permission`). Details go to the
   server log or to `Guard.Flag`.
8. **Items and money go through ug-core.** `UgCore.Inventory`, `UgCore.Weapons`, `UgCore.Shops`. Never keep a copy
   of an inventory and act on it: ug-core's client state is the mirror, its server is the truth.
9. **Distances found on the client only choose what to ask for.** The open key finds the closest trunk or stash;
   ug-core checks reach again on the server.
10. **Statebags are set by the server only.**
11. **The NUI page is untrusted.** Any script in CEF can post to your NUI callbacks. `client/nui.lua` checks every body
    with a schema, rate limits callbacks, and `client/screen.lua` checks the request matches the open state (a move to
    `other` needs an open container, a buy needs an open shop).
12. **Nothing server-only in `files {}`.** No `server/`, `config.lua`, `tests/`. The repository check fails otherwise.
13. **The page never builds HTML from strings** and calls `fetch` from `web/src/lib/nui.ts` only. `security.test.ts`
    fails otherwise. Production builds have a strict CSP (`vite.config.ts`).
14. **Config values replicate to every client** through GlobalState. Never put secrets (webhooks, keys) in it.

## Lifecycle and boot

- ug-core boots in stages. Wait for it before calling anything that needs players or modules:
  `UgCore.Lifecycle.Await(UgCore.Enums.Lifecycle.Ready, 60000)`.
- `items` and `inventory` are required: boot logs one clear error without them. `weapons`, `shops` and `accounts` MAY
  be disabled: check `UgCore.Modules.IsEnabled(name)` before using them, and adapt.
- The server loads config, then publishes it. Clients wait for `GlobalState['<resource>:Config']`.
- Each side prints one line when ready: `[ug-inventory] v1.0.0 ready. 2 stash point(s), weapons on, shops on.` on the
  server, `[ug-inventory] Ready: hotbar 5, wheel 8.` in F8. Config errors print one line each, then a summary.

## Player-facing text

Everything a player reads goes through `locales/<code>.json`. Lua uses `UgLib.Locale.Create()` and
`label('key', { var = value })`. The page gets the `page` group. Every locale has the same keys as `en.json` (tested).
Error codes have a text under `page.error.<code>` (tested). Placeholders are `{name}`.

## Verification

Every change MUST pass these before commit. CI runs them on pushes and pull requests to `dev` and `main`.
ug-core and ug-lib MUST be cloned next to this repository (`../ug-core`, `../ug-lib`), or set `UG_CORE` and `UG_LIB`.

```bash
# 1. LuaLS strict check, zero problems. Add ug-core, ug-lib and the CfxLua natives as workspace.library in your
#    editor or a CI-style config; .luarc.json MUST NOT set workspace.library.
lua-language-server --check . --checklevel=Information --configpath=.luarc.json

# 2. Lua tests
for suite in tests/*.lua; do [ "$suite" = tests/helpers.lua ] || lua5.4 "$suite" || exit 1; done

# 3. Manifest and license headers
lua5.4 .github/scripts/check-repository.lua

# 4. Web page (Node.js 20.19+)
cd web && npm ci && npm run lint && npm run typecheck && npm test && npm run build && npm run budget
```

Every change in behavior adds or extends a test. Tests cover behavior, not cosmetics.

## Git

- Conventional Commits. Lowercase imperative subject, no trailing period, 72 characters at most.
  Scopes: `core`, `api`, `nui`, `web`, `config`, `locale`, `ci`, `deps`. Add yours to `.github/workflows/pr-title.yml`.
- Branch off `dev`: `<type>/<issue>-<short-description>`. Pull requests go to `dev`.
- Commit subjects become release notes. Write them for server owners.
- Breaking changes to exports, config or database are MAJOR: mark them with `!` or a `BREAKING CHANGE` footer.
- Never bump `version` by hand. release-please bumps it on `main` from the commits.
- `dev` reaches `main` through pull requests merged with a merge commit, never squashed.

## Never

- Define a global other than the resource's one.
- Register a raw net event, or trust anything a client or the page sends.
- Accept an unbounded string, array or map.
- Tell a client which security check failed.
- Write to `config.lua` except to generate it when missing.
- List server-only files in `files {}`.
- Depend on another framework or UI library.
- Commit with a failing check.
