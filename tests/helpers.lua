--[[

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

]] --

-- Test helpers: a tiny runner, CfxLua mocks, and the real ug-core and ug-lib shared code this resource relies on.
-- ug-core and ug-lib are read from the UG_CORE and UG_LIB paths, siblings of this repository by default.
-- Mock only what the resource uses. Add a mock here when new code calls a new native or UgCore function.

---@class TestHelpers
local H = {}

H.Resource = 'ug-inventory'
H.CorePath = os.getenv('UG_CORE') or '../ug-core'
H.LibPath = os.getenv('UG_LIB') or '../ug-lib'

local passed, failed = 0, 0
local rawType = type
local vectorKinds = setmetatable({}, {
    __mode = 'k',
})

---The CfxLua `type` names vectors.
---@param value any
---@return string
type = function(value)
    return rawType(value) == 'table' and vectorKinds[value] or rawType(value)
end

local KEYS = { 'x', 'y', 'z', 'w' }
local vectorMeta = {}

---@param kind string
---@param components table
---@return table
local function newVector(kind, components)
    vectorKinds[components] = kind

    return setmetatable(components, vectorMeta)
end

---Vectors subtract, add and measure like CfxLua ones: `#(a - b)` is a distance.
vectorMeta.__sub = function(a, b)
    local result = {}

    for _, key in ipairs(KEYS) do
        if a[key] then
            result[key] = a[key] - b[key]
        end
    end

    return newVector(vectorKinds[a], result)
end

vectorMeta.__add = function(a, b)
    local result = {}

    for _, key in ipairs(KEYS) do
        if a[key] then
            result[key] = a[key] + b[key]
        end
    end

    return newVector(vectorKinds[a], result)
end

vectorMeta.__len = function(a)
    local total = 0

    for _, key in ipairs(KEYS) do
        total = total + (a[key] or 0) ^ 2
    end

    return math.sqrt(total)
end

function vector2(x, y) return newVector('vector2', { x = x, y = y }) end

function vector3(x, y, z) return newVector('vector3', { x = x, y = y, z = z }) end

function vector4(x, y, z, w) return newVector('vector4', { x = x, y = y, z = z, w = w }) end

---@type table<string, string|false> file contents by path; false reads as missing
H.Files = {}
---@type table<string, string> files written by SaveResourceFile
H.Saved = {}
---@type table<string, function[]> FiveM event handlers
H.Handlers = {}
---@type table<string, function> exports of this resource
H.Exports = {}
H.Now = 0
H.CoreReady = true
---@type table<string, boolean> enabled ug-core modules
H.Modules = {}

-- Server side.

---@type table<string, table<string, any>> ug-core config values by config name and key
H.CoreConfig = {}
---@type { name: string, args: any[] }[] events emitted through UgCore.Events
H.Emitted = {}

-- Client side.

---@type { name: string, args: any[] }[] ug-core calls the client made: `Inventory.MoveBetween`, `Shops.Buy`, ...
H.Requests = {}
---@type table<string, { [1]: boolean, [2]: string? }> what a ug-core action answers, by call name; ok by default
H.Answers = {}
---@type table<string, function[]> UgCore.Events.On listeners by event name
H.Listeners = {}
---@type table? the player inventory ug-core holds: `{ slots, maxWeight, items = { [slot] = item } }`, nil before load
H.Inventory = nil
---@type table? the inventory open next to the player, as Inventory.GetOther returns it
H.Other = nil
---@type table<string, vector3> drops by id
H.Drops = {}
---@type table<string, table> item definitions
H.Items = {}
---@type table<string, { label: string, coords: vector3[] }> shops
H.Shops = {}
---@type table<string, table> shop listings by name, as Shops.Open returns them
H.Listings = {}
H.Balance = 0
H.Dead, H.Downed = false, false
---@type table<integer, table> statebags of other players by server id
H.PlayerStates = {}
---@type table<string, fun(body: any, cb: fun(reply: any))>
H.NuiCallbacks = {}
---@type table[] ug-lib keybinds registered
H.Keybinds = {}
---@type table<string, table> items registered through UgCore.Items.Register
H.Registered = {}
---@type table<string, { handler: function, options: table }> item uses registered
H.Uses = {}
---@type table<string, { options: table, handler: function }> server callbacks registered
H.Callbacks = {}
---@type { target: integer, name: string, args: any[] }[] events sent to clients
H.Sent = {}
---@type table<string, table> exports of other resources, by resource
H.Remote = {}
---@type table<string, string> GetResourceState answers; missing by default
H.ResourceStates = {}
---@type table<string, function> client net events registered through UgCore.Network.Register
H.NetHandlers = {}
---@type table<string, any[]> what UgCore.Callback.Await answers, by full name; ok by default
H.CallbackAnswers = {}
H.Locale = 'en'

function GetCurrentResourceName()
    return H.Resource
end

---@param _ string
---@param path string
---@return string?
function LoadResourceFile(_, path)
    if H.Files[path] ~= nil then
        return H.Files[path] or nil
    end

    local handle = io.open(path, 'rb')

    if not handle then
        return nil
    end

    local content = handle:read('a')

    handle:close()

    return content
end

function SaveResourceFile(_, path, content)
    H.Saved[path] = content
    H.Files[path] = content

    return true
end

function GetResourceMetadata(_, key)
    return key == 'version' and '1.0.0' or nil
end

---@type { thread: thread, wakeAt: integer }[] threads waiting in Wait
local sleeping = {}

---@param thread thread
local function resume(thread)
    local ok, result = coroutine.resume(thread)

    if not ok then
        error(debug.traceback(thread, tostring(result)), 0)
    end

    if coroutine.status(thread) == 'suspended' then
        sleeping[#sleeping + 1] = {
            thread = thread,
            wakeAt = H.Now + math.max(result or 0, 1),
        }
    end
end

---Like FiveM: the thread runs at once until its first Wait.
function CreateThread(fn)
    resume(coroutine.create(fn))
end

---Yields until H.Advance reaches the time. Outside a thread it only moves the clock.
---@param ms? integer
function Wait(ms)
    if coroutine.isyieldable() then
        coroutine.yield(ms or 0)
    else
        H.Now = H.Now + (ms or 0)
    end
end

---Runs frames of 16 ms until `ms` passed, waking threads whose time came.
---@param ms integer
function H.Advance(ms)
    local target = H.Now + ms

    repeat
        H.Now = math.min(H.Now + 16, target)

        local ready = {}

        for index = #sleeping, 1, -1 do
            if sleeping[index].wakeAt <= H.Now then
                ready[#ready + 1] = table.remove(sleeping, index)
            end
        end

        for index = #ready, 1, -1 do
            resume(ready[index].thread)
        end
    until H.Now >= target
end

---Calls of auto-mocked natives, in order: `{ name, args }`.
---@type { name: string, args: any[] }[]
H.Natives = {}

---@param name string
---@return { name: string, args: any[] }[]
function H.CallsOf(name)
    local list = {}

    for _, call in ipairs(H.Natives) do
        if call.name == name then
            list[#list + 1] = call
        end
    end

    return list
end

---@type table<string, any> answers of auto-mocked natives
H.NativeReturns = {}

-- Any other PascalCase global is a native: recorded, answering H.NativeReturns[name] or nil.
setmetatable(_G, {
    __index = function(_, name)
        if rawType(name) == 'string' and name:find('^%u') then
            return function(...)
                H.Natives[#H.Natives + 1] = {
                    name = name,
                    args = { ... },
                }

                local value = H.NativeReturns[name]

                if rawType(value) == 'function' then
                    return value(...)
                end

                return value
            end
        end

        return nil
    end,
})

function GetGameTimer()
    return H.Now
end

function AddEventHandler(name, handler)
    H.Handlers[name] = H.Handlers[name] or {}
    table.insert(H.Handlers[name], handler)
end

exports = setmetatable({}, {
    __call = function(_, name, fn)
        H.Exports[name] = fn
    end,
    -- exports['other-resource'], answered by H.Remote.
    __index = function(_, resource)
        return H.Remote[resource]
    end,
})

---@param name string
---@return string
function GetResourceState(name)
    return H.ResourceStates[name] or 'missing'
end

function RegisterNUICallback(name, handler)
    H.NuiCallbacks[name] = handler
end

---Posts to a NUI callback like the page does. Returns the reply.
---@param name string
---@param body any
---@return any
function H.PostNui(name, body)
    local reply = nil

    assert(H.NuiCallbacks[name], 'NUI callback not registered: ' .. name)(body, function(value)
        reply = value
    end)

    return reply
end

---Messages sent to the page, in order.
---@return { action: string, payload: any }[]
function H.PageMessages()
    local list = {}

    for _, call in ipairs(H.CallsOf('SendNUIMessage')) do
        list[#list + 1] = call.args[1]
    end

    return list
end

---The payload of the last page message with this action, or false when it was sent without one.
---@param action string
---@return any
function H.LastPage(action)
    local found = nil

    for _, message in ipairs(H.PageMessages()) do
        if message.action == action then
            found = message
        end
    end

    return found and (found.payload or false)
end

---Loads a Lua file into the global environment.
---@param path string
local function run(path)
    assert(loadfile(path, 't'))()
end

local function loadCore()
    for _, file in ipairs({
        'core/shared/init.lua',
        'core/shared/utils/init.lua',
        'core/shared/utils/table.lua',
        'core/shared/utils/string.lua',
        'core/shared/enums/init.lua',
        'core/shared/enums/lifecycle.lua',
        'core/shared/enums/violations.lua',
        'core/shared/enums/errors.lua',
        'core/shared/logger.lua',
        'core/shared/schema.lua',
        'core/shared/enums/events.lua',
        'core/shared/enums/hooks.lua',
        'core/shared/enums/statebags.lua',
        'modules/players/shared/enums.lua',
        'modules/items/shared/enums.lua',
        'modules/inventory/shared/enums.lua',
        'modules/weapons/shared/enums.lua',
        'modules/shops/shared/enums.lua',
    }) do
        run(H.CorePath .. '/' .. file)
    end

    UgCore.Logger.Debug = function() end
    UgCore.Lifecycle = {
        Await = function()
            return H.CoreReady
        end,
    }
    UgCore.Modules = {
        IsEnabled = function(name)
            return H.Modules[name] == true
        end,
    }
    UgCore.Events = {
        Emit = function(name, ...)
            H.Emitted[#H.Emitted + 1] = {
                name = name,
                args = { ... },
            }
        end,
    }
end

---Records a ug-core call and answers what the test set, ok by default.
---@param name string
---@return fun(...): boolean, string?
local function action(name)
    return function(...)
        H.Requests[#H.Requests + 1] = {
            name = name,
            args = { ... },
        }

        local answer = H.Answers[name]

        if answer then
            return answer[1], answer[2]
        end

        return true, nil
    end
end

local function installServer()
    UgCore.Config = {
        Get = function(name, key)
            local values = H.CoreConfig[name] or {}

            return key and values[key] or values
        end,
    }
    UgCore.Items = {
        Register = function(name, definition)
            H.Registered[name] = definition
        end,
        RegisterUse = function(name, handler, options)
            H.Uses[name] = {
                handler = handler,
                options = options,
            }
        end,
    }
    UgCore.Callback = {
        Register = function(name, options, handler)
            H.Callbacks[name] = {
                options = options,
                handler = handler,
            }
        end,
    }
    UgCore.Inventory = {
        AddItem = action('Inventory.AddItem'),
        RemoveItem = action('Inventory.RemoveItem'),
        RemoveFromSlot = action('Inventory.RemoveFromSlot'),
    }
    UgCore.Network = {
        TriggerClient = function(target, name, ...)
            H.Sent[#H.Sent + 1] = {
                target = target,
                name = name,
                args = { ... },
            }
        end,
    }
end

---@param items table<integer, table>
---@return table[]
local function bySlot(items)
    local list = {}

    for slot, item in pairs(items) do
        list[#list + 1] = {
            slot = slot,
            name = item.name,
            count = item.count,
            metadata = item.metadata,
        }
    end

    table.sort(list, function(a, b)
        return a.slot < b.slot
    end)

    return list
end

local function installClient()
    UgCore.Callback = {
        Await = function(name, ...)
            H.Requests[#H.Requests + 1] = {
                name = 'Callback.' .. name,
                args = { ... },
            }

            local answer = H.CallbackAnswers[name]

            if answer then
                return answer[1], answer[2], answer[3]
            end

            return true, {
                ok = true,
            }, nil
        end,
    }
    UgCore.Network = {
        Register = function(name, handler)
            H.NetHandlers[name] = handler
        end,
    }
    UgCore.Events.On = function(name, handler)
        H.Listeners[name] = H.Listeners[name] or {}
        table.insert(H.Listeners[name], handler)
    end
    UgCore.LocalPlayer = {
        IsDead = function()
            return H.Dead
        end,
        IsDowned = function()
            return H.Downed
        end,
    }
    UgCore.Items = {
        GetAll = function()
            return H.Items
        end,
    }
    UgCore.Inventory = {
        IsLoaded = function()
            return H.Inventory ~= nil
        end,
        GetItems = function()
            return bySlot(H.Inventory and H.Inventory.items or {})
        end,
        GetSlot = function(slot)
            local item = H.Inventory and H.Inventory.items[slot]

            return item and {
                slot = slot,
                name = item.name,
                count = item.count,
                metadata = item.metadata,
            } or nil
        end,
        GetSlots = function()
            return H.Inventory and H.Inventory.slots or 0
        end,
        GetMaxWeight = function()
            return H.Inventory and H.Inventory.maxWeight or 0
        end,
        GetOther = function()
            return H.Other
        end,
        GetDrops = function()
            return H.Drops
        end,
        Open = action('Inventory.Open'),
        Close = action('Inventory.Close'),
        MoveBetween = action('Inventory.MoveBetween'),
        Use = action('Inventory.Use'),
        Give = action('Inventory.Give'),
        Drop = action('Inventory.Drop'),
    }
    UgCore.Weapons = {
        Attach = action('Weapons.Attach'),
        Detach = action('Weapons.Detach'),
        Reload = action('Weapons.Reload'),
        Unload = action('Weapons.Unload'),
    }
    UgCore.Shops = {
        GetAll = function()
            return H.Shops
        end,
        Open = function(name)
            H.Requests[#H.Requests + 1] = {
                name = 'Shops.Open',
                args = { name },
            }

            local listing = H.Listings[name]

            if not listing then
                return false, UgCore.Enums.Errors.NotFound, nil
            end

            return true, nil, listing
        end,
        Buy = action('Shops.Buy'),
    }
    UgCore.Accounts = {
        GetBalance = function()
            return H.Balance
        end,
    }
    UgLib.Enums = UgLib.Enums or {}
    UgLib.Enums.GlobalState = {
        Config = 'ug-lib:Config',
    }
    UgLib.Locale = {
        Create = function()
            return function(key, vars)
                return 'label:' .. key .. (vars and vars.slot and (':' .. vars.slot) or '')
            end
        end,
        GetCode = function()
            return H.Locale
        end,
    }
    UgLib.Keybind = {
        Register = function(options)
            H.Keybinds[#H.Keybinds + 1] = options

            return ('+%s-%s'):format(H.Resource, options.name)
        end,
    }
    UgLib.Streaming = {
        Model = function()
            return true
        end,
    }
end

---Fires a ug-core event to every UgCore.Events.On listener.
---@param name string
function H.Fire(name, ...)
    for _, handler in ipairs(H.Listeners[name] or {}) do
        handler(...)
    end
end

---Calls of one ug-core action, in order.
---@param name string
---@return any[][] arguments of each call
function H.RequestsOf(name)
    local list = {}

    for _, request in ipairs(H.Requests) do
        if request.name == name then
            list[#list + 1] = request.args
        end
    end

    return list
end

---Statebags of other players: `Player(id).state[key]`.
---@param id integer
---@return { state: table }
function Player(id)
    return {
        state = H.PlayerStates[id] or {},
    }
end

local function loadLib()
    for _, file in ipairs({ 'shared/init.lua', 'shared/utils.lua', 'shared/string.lua', 'shared/table.lua' }) do
        run(H.LibPath .. '/' .. file)
    end
end

---Reads script lists from fxmanifest.lua.
---@return table<string, string[]>
local function readManifest()
    local lists = {
        shared = {},
        server = {},
        client = {},
    }
    local groups = {
        shared_script = 'shared', shared_scripts = 'shared',
        server_script = 'server', server_scripts = 'server',
        client_script = 'client', client_scripts = 'client',
    }
    local env = setmetatable({}, {
        __index = function(_, directive)
            return function(value)
                local group = groups[directive]

                if group then
                    for _, entry in ipairs(rawType(value) == 'table' and value or { value }) do
                        table.insert(lists[group], entry)
                    end
                end
            end
        end,
    })

    assert(loadfile('fxmanifest.lua', 't', env))()

    return lists
end

---Fresh mocks. Tests change them before H.Load. `config.lua` starts missing, whatever is on disk.
function H.Reset()
    H.Files, H.Saved = {
        ['config.lua'] = false,
    }, {}
    H.Handlers, H.Exports = {}, {}
    H.Now, H.CoreReady = 1000, true
    H.Modules = {
        items = true,
        inventory = true,
        weapons = true,
        shops = true,
        accounts = true,
    }
    H.Natives = {}
    H.NativeReturns = {
        PlayerPedId = 100,
        PlayerId = 0,
        GetEntityCoords = function()
            return vector3(0.0, 0.0, 0.0)
        end,
        GetVehiclePedIsIn = 0,
        GetGamePool = {},
        GetActivePlayers = {},
        GetEntityBoneIndexByName = -1,
        IsPauseMenuActive = false,
        IsPedInAnyVehicle = false,
        IsRadarHidden = false,
        ClonePed = 300,
        IsFrontendReadyForControl = true,
        HasAnimDictLoaded = true,
        GetHudColour = function()
            return 10, 20, 30, 200
        end,
        DoesEntityExist = true,
        GetCurrentFrontendMenuVersion = 0,
    }
    H.CoreConfig = {
        inventory = {},
    }
    H.Emitted, H.Requests, H.Answers, H.Listeners = {}, {}, {}, {}
    H.Inventory = {
        slots = 10,
        maxWeight = 30000,
        items = {
            [1] = {
                name = 'water',
                count = 3,
            },
        },
    }
    H.Other, H.Drops, H.Shops, H.Listings = nil, {}, {}, {}
    H.Items = {
        water = {
            label = 'Water',
            weight = 500,
            stack = true,
            maxStack = 10,
            usable = true,
        },
        weapon_pistol = {
            label = 'Pistol',
            weight = 1200,
            stack = false,
            maxStack = 1,
            usable = true,
        },
    }
    H.Balance, H.Dead, H.Downed, H.PlayerStates = 0, false, false, {}
    H.NuiCallbacks, H.Keybinds, H.Locale = {}, {}, 'en'
    H.Registered, H.Uses, H.Callbacks, H.Sent, H.Remote, H.ResourceStates = {}, {}, {}, {}, {}, {}
    H.NetHandlers, H.CallbackAnswers = {}, {}
    GlobalState = setmetatable({}, {
        __index = {
            set = function(self, key, value)
                rawset(self, key, value)
            end,
        },
    })
    sleeping = {}
    UgCore, UgLib, UgInventory = nil, nil, nil
end

---Loads ug-core and ug-lib, then this resource's shared and side scripts in manifest order.
---@param side 'server'|'client'
---@return string[] printed lines
function H.Load(side)
    return H.Capture(function()
        loadCore()
        loadLib()

        if side == 'server' then
            installServer()
        else
            installClient()
        end

        local manifest = readManifest()

        for _, group in ipairs({ 'shared', side }) do
            for _, path in ipairs(manifest[group]) do
                if path:sub(1, 1) ~= '@' then
                    run(path)
                end
            end
        end
    end)
end

---The defaults, read from server/config.default.lua like the server reads them.
---@return table
function H.Defaults()
    local content = assert(LoadResourceFile('ug-inventory', 'server/config.default.lua'))
    local env = setmetatable({}, {
        __index = _G,
    })

    return assert(load(content, '@server/config.default.lua', 't', env))()
end

---Loads the client with the server's config replicated, and opens the page.
---@param overrides? table config values that replace the defaults
---@return string[] printed lines
function H.LoadClient(overrides)
    local values = H.Defaults()

    for key, value in pairs(overrides or {}) do
        values[key] = value
    end

    GlobalState['ug-inventory:Config'] = values

    local lines = H.Load('client')

    H.PostNui('ready', {})

    return lines
end

---Runs `fn` after `ms`, in a thread, like the CfxLua SetTimeout.
---@param ms integer
---@param fn function
function SetTimeout(ms, fn)
    CreateThread(function()
        Wait(ms)
        fn()
    end)
end

---@param name string
---@return integer
function joaat(name)
    local hash = 0

    for index = 1, #name do
        hash = (hash * 31 + name:byte(index)) % 4294967296
    end

    return hash
end

---Runs every handler of a FiveM event, like the runtime.
---@param name string
function H.TriggerEvent(name, ...)
    for _, handler in ipairs(H.Handlers[name] or {}) do
        handler(...)
    end
end

---Runs `fn` and returns every printed line, without color codes.
---@param fn fun()
---@return string[]
function H.Capture(fn)
    local lines = {}
    local original = print

    print = function(...)
        local parts = {}

        for index = 1, select('#', ...) do
            parts[#parts + 1] = tostring((select(index, ...)))
        end

        lines[#lines + 1] = (table.concat(parts, ' '):gsub('%^%d', ''))
    end

    local ok, err = pcall(fn)

    print = original

    if not ok then
        error(err, 0)
    end

    return lines
end

---@param a any
---@param b any
---@return boolean
local function same(a, b)
    if rawType(a) ~= 'table' or rawType(b) ~= 'table' then
        return a == b
    end

    if vectorKinds[a] ~= vectorKinds[b] then
        return false
    end

    for key, value in pairs(a) do
        if not same(value, b[key]) then
            return false
        end
    end

    for key in pairs(b) do
        if a[key] == nil then
            return false
        end
    end

    return true
end

---@param value any
---@param depth? integer
---@return string
local function show(value, depth)
    depth = depth or 0

    if rawType(value) ~= 'table' then
        return rawType(value) == 'string' and ('%q'):format(value) or tostring(value)
    end

    if depth > 3 then
        return '{...}'
    end

    local parts = {}

    for key, item in pairs(value) do
        parts[#parts + 1] = ('%s = %s'):format(tostring(key), show(item, depth + 1))
    end

    table.sort(parts)

    return (vectorKinds[value] or '') .. '{ ' .. table.concat(parts, ', ') .. ' }'
end

function H.Equal(actual, expected, message)
    if not same(actual, expected) then
        error(('%s\n  expected: %s\n  actual:   %s'):format(message or 'not equal', show(expected), show(actual)), 2)
    end
end

function H.Assert(condition, message)
    if not condition then
        error(message or 'assertion failed', 2)
    end
end

---Runs `fn` and expects it to raise an error containing `text`.
---@param fn fun()
---@param text string
function H.Raises(fn, text)
    local ok, err = pcall(fn)

    if ok then
        error(('expected an error containing "%s"'):format(text), 2)
    end

    if not tostring(err):find(text, 1, true) then
        error(('expected an error containing "%s", got: %s'):format(text, tostring(err)), 2)
    end
end

---@param lines string[]
---@param text string
function H.ExpectLine(lines, text)
    for _, line in ipairs(lines) do
        if line:find(text, 1, true) then
            return
        end
    end

    error(('no line contains "%s":\n  %s'):format(text, table.concat(lines, '\n  ')), 2)
end

---Wrong-type values for tests. LuaLS ignores casts on literals.
---@param value any
---@return any
function H.Any(value)
    return value
end

---@param name string
---@param fn fun()
function H.Test(name, fn)
    local ok, err = xpcall(fn, debug.traceback)

    if ok then
        passed = passed + 1
        print('  ok    ' .. name)
    else
        failed = failed + 1
        print('  FAIL  ' .. name .. '\n        ' .. tostring(err):gsub('\n', '\n        '))
    end
end

function H.Done()
    print(('\n%d passed, %d failed'):format(passed, failed))
    os.exit(failed == 0 and 0 or 1)
end

---Minimal json like the CfxLua one: objects, arrays, strings, numbers, booleans.
json = {}

---@param text string
---@return any
function json.decode(text)
    local position = 1

    local function skip()
        position = text:find('[^%s]', position) or #text + 1
    end

    local parse

    local function parseString()
        local result = {}

        position = position + 1

        while true do
            local char = text:sub(position, position)

            if char == '' then
                error('unterminated string')
            end

            if char == '"' then
                position = position + 1

                return table.concat(result)
            end

            if char == '\\' then
                local escape = text:sub(position + 1, position + 1)

                if escape == 'u' then
                    result[#result + 1] = utf8.char(tonumber(text:sub(position + 2, position + 5), 16))
                    position = position + 6
                else
                    result[#result + 1] = ({
                        n = '\n',
                        t = '\t',
                        r = '\r',
                    })[escape] or escape
                    position = position + 2
                end
            else
                result[#result + 1] = char
                position = position + 1
            end
        end
    end

    ---@param close string
    ---@param item fun(result: table)
    ---@return table
    local function collection(close, item)
        local result = {}

        position = position + 1
        skip()

        if text:sub(position, position) == close then
            position = position + 1

            return result
        end

        while true do
            item(result)
            skip()

            local separator = text:sub(position, position)

            position = position + 1

            if separator == close then
                return result
            end

            if separator ~= ',' then
                error('expected , or ' .. close)
            end
        end
    end

    parse = function()
        skip()

        local char = text:sub(position, position)

        if char == '{' then
            return collection('}', function(result)
                skip()

                local key = parseString()

                skip()
                position = position + 1
                result[key] = parse()
            end)
        end

        if char == '[' then
            return collection(']', function(result)
                result[#result + 1] = parse()
            end)
        end

        if char == '"' then
            return parseString()
        end

        for literal, value in pairs({
            ['true'] = true,
            ['false'] = false,
        }) do
            if text:sub(position, position + #literal - 1) == literal then
                position = position + #literal

                return value
            end
        end

        if text:sub(position, position + 3) == 'null' then
            position = position + 4

            return nil
        end

        local number = text:match('^-?%d+%.?%d*[eE]?[-+]?%d*', position)

        if not number or number == '' then
            error('unexpected character at ' .. position)
        end

        position = position + #number

        return math.tointeger(tonumber(number)) or tonumber(number)
    end

    return parse()
end

return H
