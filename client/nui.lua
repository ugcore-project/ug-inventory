--[[

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

]] --

-- The page bridge. The page is untrusted: any script in CEF can post to these callbacks, so every body is
-- read through a schema here before a handler sees it, and the page MAY post only so often.

---@class UgInventory.Internal.Nui
local Nui = {}
UgInventory.Internal.Nui = Nui

local Enums = UgInventory.Enums
local Action = Enums.NuiAction
local Callback = Enums.NuiCallback
local Schema = UgCore.Schema

local RESOURCE = GetCurrentResourceName()
-- Callbacks per second the page MAY send. Drag and drop and turning the character post often: the page throttles
-- turning to 20 a second. ug-core rate limits every inventory action again on the server.
local EVENTS_PER_SECOND = 40
-- Sounds per second the page MAY ask for, on a budget of their own: hovering never blocks an action.
local SOUNDS_PER_SECOND = 12
local FALLBACK_LOCALE = 'en'

local ready = false
---@type table[] messages sent before the page was ready
local queue = {}
local budget = {
    second = -1,
    count = 0,
}
local soundBudget = {
    second = -1,
    count = 0,
}
---@type table<UgInventoryNuiCallback, fun(value: any)>
local handlers = {}

---Sends a message, or queues it until the page is ready.
---@param action UgInventoryNuiAction
---@param payload? table
function Nui.Send(action, payload)
    local message = {
        action = action,
        payload = payload,
    }

    if ready then
        SendNUIMessage(message)
    else
        queue[#queue + 1] = message
    end
end

---The `page` group of locales/<code>.json, or of English when that file is missing or broken.
---@return table
function Nui.Labels()
    for _, code in ipairs({ UgLib.Locale.GetCode(), FALLBACK_LOCALE }) do
        local content = LoadResourceFile(RESOURCE, ('locales/%s.json'):format(code))

        if content then
            local ok, decoded = pcall(json.decode, content)

            if ok and type(decoded) == 'table' and type(decoded.page) == 'table' then
                return decoded.page
            end
        end
    end

    return {}
end

---ug-lib's theme, so every UgCore screen looks the same, with this screen's own values on top. Colors merge token
---by token.
---@param base any ug-lib's theme
---@param own any owner config theme
---@return table
function Nui.Theme(base, own)
    base = type(base) == 'table' and base or {}
    own = type(own) == 'table' and own or {}

    local colors = {}

    -- Not ipairs over both: it stops at a missing ug-lib table and drops the owner colors.
    for index = 1, 2 do
        local source = index == 1 and base.colors or own.colors

        if type(source) == 'table' then
            for token, color in pairs(source) do
                colors[token] = color
            end
        end
    end

    return {
        mode = own.mode or base.mode,
        colors = colors,
        radius = own.radius or base.radius,
        font = own.font or base.font,
        scale = own.scale or base.scale,
    }
end

---What the page gets first: the theme, the labels, the layout and the features.
---@return table
local function config()
    local libConfig = GlobalState[UgLib.Enums.GlobalState.Config]

    local settings = GlobalState['ug-inventory:Config']
    settings = type(settings) == 'table' and settings or {}

    return {
        theme = Nui.Theme(type(libConfig) == 'table' and libConfig.theme or nil, settings.theme),
        labels = Nui.Labels(),
        locale = UgLib.Locale.GetCode(),
        hotbar = settings.hotbarSlots or 0,
        wheel = settings.wheelSlots or 0,
        toasts = settings.toasts ~= false,
        sounds = settings.sounds ~= false,
        openKey = settings.openKey,
        layout = settings.layout,
        toastDuration = settings.toastDuration,
        giving = settings.giving ~= false,
        dropping = settings.dropping ~= false,
        workbench = settings.workbench ~= false,
    }
end

---Sets who receives a page callback. The handler gets the validated value.
---@param callback UgInventoryNuiCallback
---@param handler fun(value: any)
function Nui.On(callback, handler)
    handlers[callback] = handler
end

---@param bucket { second: integer, count: integer }
---@param limit integer
---@return boolean
local function withinBudget(bucket, limit)
    local second = GetGameTimer() // 1000

    if bucket.second ~= second then
        bucket.second, bucket.count = second, 0
    end

    bucket.count = bucket.count + 1

    return bucket.count <= limit
end

---A reader that checks the whole body with an object rule.
---@param fields table<string, UgSchemaRule>
---@return fun(body: any): any
local function bodyOf(fields)
    local rule = Schema.Object(fields)

    return function(body)
        local ok, value = Schema.Check(rule, body)

        return ok and value or nil
    end
end

local ID = Schema.Integer({
    min = 1,
    max = 2147483647,
})
local SLOT = Schema.Integer({
    min = 1,
    max = 1000,
})
local COUNT = Schema.Optional(Schema.Integer({
    min = 1,
    max = 1000000,
}))
local SIDE = Schema.Enum({ Enums.Side.Player, Enums.Side.Other })
local PIECE = Schema.Enum((function()
    local list = {}

    for _, piece in pairs(Enums.ClothingPiece) do
        list[#list + 1] = piece
    end

    table.sort(list)

    return list
end)())

-- One reader per callback. A reader returns the checked value, or nil to reject the body.
---@type table<UgInventoryNuiCallback, fun(body: any): any>
local READERS = {
    [Callback.Close] = function()
        return true
    end,
    [Callback.Move] = bodyOf({
        id = ID,
        from = SIDE,
        fromSlot = SLOT,
        to = SIDE,
        toSlot = SLOT,
        count = COUNT,
    }),
    [Callback.Use] = bodyOf({
        id = ID,
        slot = SLOT,
    }),
    [Callback.Give] = bodyOf({
        id = ID,
        slot = SLOT,
        count = COUNT,
        target = Schema.Integer({
            min = 1,
            max = 65535,
        }),
    }),
    [Callback.Drop] = bodyOf({
        id = ID,
        slot = SLOT,
        count = COUNT,
    }),
    [Callback.Buy] = bodyOf({
        id = ID,
        index = Schema.Integer({
            min = 1,
            max = 200,
        }),
        count = Schema.Integer({
            min = 1,
            max = 1000,
        }),
    }),
    [Callback.Attach] = bodyOf({
        id = ID,
        weaponSlot = SLOT,
        itemSlot = SLOT,
    }),
    [Callback.Detach] = bodyOf({
        id = ID,
        slot = SLOT,
        item = Schema.String({
            min = 1,
            max = 64,
            pattern = '^%l[%l%d_]*$',
        }),
    }),
    [Callback.Reload] = bodyOf({
        id = ID,
    }),
    [Callback.Unload] = bodyOf({
        id = ID,
    }),
    [Callback.Clothing] = bodyOf({
        id = ID,
        piece = PIECE,
    }),
    -- slot 0 closes the wheel without using anything.
    [Callback.WheelPick] = bodyOf({
        slot = Schema.Integer({
            min = 0,
            max = 10,
        }),
    }),
}

for name, read in pairs(READERS) do
    RegisterNUICallback(name, function(body, cb)
        local value = nil

        if withinBudget(budget, EVENTS_PER_SECOND) then
            value = read(body)
        end

        if value ~= nil and handlers[name] then
            handlers[name](value)
        end

        cb({
            ok = value ~= nil,
        })
    end)
end

local readSound = bodyOf({
    sound = Schema.Enum({ Enums.Sound.Hover, Enums.Sound.Pick, Enums.Sound.Menu }),
})

RegisterNUICallback(Callback.Sound, function(body, cb)
    local value = withinBudget(soundBudget, SOUNDS_PER_SECOND) and readSound(body) or nil

    if value and handlers[Callback.Sound] then
        handlers[Callback.Sound](value)
    end

    cb({
        ok = value ~= nil,
    })
end)

-- The page posts ready once it listens. It reloads after a crash: config is sent again each time.
RegisterNUICallback(Callback.Ready, function(_, cb)
    ready = true
    SendNUIMessage({
        action = Action.Config,
        payload = config(),
    })

    for _, message in ipairs(queue) do
        SendNUIMessage(message)
    end

    queue = {}
    cb({
        ok = true,
    })
end)
