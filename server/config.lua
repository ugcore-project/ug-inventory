--[[

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

]] --

-- Owner config: config.lua, copied from server/config.default.lua on the first start and never overwritten.
-- Owner values replace the defaults key by key. Clients get every value through GlobalState: never put secrets here.

---@class UgInventory.Internal.Config
local Config = {}
UgInventory.Internal.Config = Config

local Schema = UgCore.Schema

local RESOURCE = GetCurrentResourceName()
local OWNER_FILE = 'config.lua'
local DEFAULT_FILE = 'server/config.default.lua'
local STATE_KEY = 'ug-inventory:Config'

Config.StateKey = STATE_KEY

local KEY = Schema.String({
    min = 1,
    max = 16,
    pattern = '^[%w_]+$',
})
local Enums = UgInventory.Enums
local Garments = UgInventory.Internal.Garments

---@param enum table<string, string>
---@return string[]
local function valuesOf(enum)
    local list = {}

    for _, value in pairs(enum) do
        list[#list + 1] = value
    end

    table.sort(list)

    return list
end

local PIECES = valuesOf(Enums.ClothingPiece)
local COMPONENT_PIECES = {}

for _, piece in ipairs(PIECES) do
    if Garments.Pieces[piece].kind == 'component' then
        COMPONENT_PIECES[#COMPONENT_PIECES + 1] = piece
    end
end

---@param list string[]
---@return boolean ok
---@return string? message
local function unique(list)
    local seen = {}

    for _, value in ipairs(list) do
        if seen[value] then
            return false, ('lists "%s" twice'):format(value)
        end

        seen[value] = true
    end

    return true, nil
end

-- ug-lib's theme tokens, then this screen's own.
local THEME_TOKENS = {
    'background', 'foreground', 'card', 'cardForeground', 'popover', 'popoverForeground',
    'primary', 'primaryForeground', 'secondary', 'secondaryForeground', 'muted', 'mutedForeground',
    'accent', 'accentForeground', 'destructive', 'destructiveForeground', 'success', 'successForeground',
    'warning', 'warningForeground', 'border', 'input', 'ring',
    'weapon', 'ammo', 'attachment', 'consumable', 'clothing', 'item', 'overlay',
}
local HSL = Schema.String({
    min = 5,
    max = 24,
    pattern = '^%d+%.?%d* %d+%.?%d*%% %d+%.?%d*%%$',
})
local SOUNDS = valuesOf(Enums.Sound)
local GAME_NAME = Schema.String({
    min = 1,
    max = 64,
    pattern = '^[%w_%-]+$',
})
local ANIM_NAME = Schema.String({
    min = 1,
    max = 64,
    pattern = '^[%w_@%-%.]+$',
})
local DURATION = Schema.Integer({
    min = 100,
    max = 10000,
})

---@param value string
---@return boolean ok
---@return string? message
local function size(value)
    if value:find('^%d*%.?%d+rem$') or value:find('^%d*%.?%d+px$') then
        return true, nil
    end

    return false, 'MUST be a size such as "0.75rem" or "12px"'
end

-- One rule per key. Every string, array and map is bounded.
---@type { key: string, rule: UgSchemaRule }[]
local RULES = {
    {
        key = 'openKey',
        rule = KEY,
    },
    {
        key = 'wheelKey',
        rule = KEY,
    },
    {
        key = 'hotbarSlots',
        rule = Schema.Integer({
            min = 0,
            max = 9,
        }),
    },
    {
        key = 'wheelSlots',
        rule = Schema.Integer({
            min = 0,
            max = 10,
        }),
    },
    {
        key = 'trunkDistance',
        rule = Schema.Number({
            min = 0.5,
            max = 10,
        }),
    },
    {
        key = 'dropDistance',
        rule = Schema.Number({
            min = 0.5,
            max = 10,
        }),
    },
    {
        key = 'stashDistance',
        rule = Schema.Number({
            min = 0.5,
            max = 10,
        }),
    },
    {
        key = 'shopDistance',
        rule = Schema.Number({
            min = 0.5,
            max = 10,
        }),
    },
    {
        key = 'giveDistance',
        rule = Schema.Number({
            min = 0.5,
            max = 10,
        }),
    },
    {
        key = 'respectLocks',
        rule = Schema.Boolean(),
    },
    {
        key = 'pedPreview',
        rule = Schema.Boolean(),
    },
    {
        key = 'toasts',
        rule = Schema.Boolean(),
    },
    {
        key = 'sounds',
        rule = Schema.Boolean(),
    },
    {
        key = 'clothing',
        rule = Schema.Boolean(),
    },
    {
        key = 'clothingMode',
        rule = Schema.Enum(valuesOf(Enums.ClothingMode)),
    },
    {
        key = 'clothingPieces',
        rule = Schema.Array(Schema.Enum(PIECES), {
            max = #PIECES,
            validate = unique,
        }),
    },
    {
        key = 'clothingNaked',
        rule = Schema.Map(
            Schema.String({
                min = 1,
                max = 64,
                pattern = '^[%w_]+$',
            }),
            Schema.Map(Schema.Enum(COMPONENT_PIECES), Schema.Integer({
                min = 0,
                max = 4095,
            }), {
                max = #COMPONENT_PIECES,
            }),
            {
                max = 16,
            }
        ),
    },
    {
        key = 'disableWeaponWheel',
        rule = Schema.Boolean(),
    },
    {
        key = 'dropModel',
        rule = Schema.String({
            min = 1,
            max = 64,
            pattern = '^[%w_]+$',
        }),
    },
    {
        key = 'dropRenderDistance',
        rule = Schema.Number({
            min = 5,
            max = 200,
        }),
    },
    {
        key = 'giving',
        rule = Schema.Boolean(),
    },
    {
        key = 'dropping',
        rule = Schema.Boolean(),
    },
    {
        key = 'workbench',
        rule = Schema.Boolean(),
    },
    {
        key = 'toastDuration',
        rule = Schema.Integer({
            min = 1000,
            max = 15000,
        }),
    },
    {
        key = 'theme',
        rule = Schema.Object({
            mode = Schema.Optional(Schema.Enum({ 'dark', 'light' })),
            colors = Schema.Optional(Schema.Map(Schema.Enum(THEME_TOKENS), HSL, {
                max = #THEME_TOKENS,
            })),
            radius = Schema.Optional(Schema.String({
                min = 3,
                max = 16,
                validate = size,
            })),
            font = Schema.Optional(Schema.Enum({ 'Inter' })),
            scale = Schema.Optional(Schema.Number({
                min = 0.75,
                max = 1.5,
            })),
        }),
    },
    {
        key = 'layout',
        rule = Schema.Object({
            pockets = Schema.Enum({ 'left', 'right' }),
            columns = Schema.Integer({
                min = 3,
                max = 10,
            }),
            slotSize = Schema.Number({
                min = 3.5,
                max = 8,
            }),
            vignette = Schema.Boolean(),
            hints = Schema.Boolean(),
            quantityBar = Schema.Boolean(),
            quantityPresets = Schema.Array(Schema.Integer({
                min = 1,
                max = 1000000,
            }), {
                max = 6,
            }),
            closeButton = Schema.Boolean(),
            hotbar = Schema.Enum({ 'bottom', 'top' }),
            toasts = Schema.Enum({ 'bottom-right', 'bottom-left', 'top-right', 'top-left' }),
            animations = Schema.Boolean(),
        }),
    },
    {
        key = 'soundEffects',
        rule = Schema.Map(
            Schema.Enum(SOUNDS),
            Schema.Object({
                name = GAME_NAME,
                set = GAME_NAME,
            }),
            {
                max = #SOUNDS,
            }
        ),
    },
    {
        key = 'previewAnimations',
        rule = Schema.Map(
            Schema.Enum({ 'idle', Enums.NuiCallback.Give, Enums.NuiCallback.Buy, Enums.NuiCallback.Drop }),
            Schema.Object({
                dict = ANIM_NAME,
                name = ANIM_NAME,
                duration = Schema.Optional(DURATION),
            }),
            {
                max = 4,
            }
        ),
    },
    {
        key = 'clothingAnimations',
        rule = Schema.Map(
            Schema.Enum(PIECES),
            Schema.Object({
                dict = ANIM_NAME,
                name = ANIM_NAME,
                duration = DURATION,
                upperBody = Schema.Optional(Schema.Boolean()),
            }),
            {
                max = #PIECES,
            }
        ),
    },
}

-- Table keys whose owner value merges field by field onto the default, so an owner sets only what they change.
local MERGED = {
    layout = true,
}

---Runs owner code in a sandbox with only what a config needs.
---@param content string
---@param name? string file name in errors, config.lua by default
---@return boolean ok
---@return table? values
---@return string? message
local function run(content, name)
    local env = {
        vector2 = vector2, vector3 = vector3, vector4 = vector4,
        vec2 = vec2, vec3 = vec3, vec4 = vec4,
        tonumber = tonumber, tostring = tostring, type = type, pairs = pairs, ipairs = ipairs,
        math = setmetatable({}, {
            __index = math,
        }),
        string = setmetatable({}, {
            __index = string,
        }),
        table = setmetatable({}, {
            __index = table,
        }),
    }

    local chunk, syntaxError = load(content, '@' .. (name or OWNER_FILE), 't', env)

    if not chunk then
        return false, nil, tostring(syntaxError)
    end

    local ok, result = pcall(chunk)

    if not ok then
        return false, nil, tostring(result)
    end

    if type(result) ~= 'table' then
        return false, nil, 'MUST return a table'
    end

    return true, result, nil
end

---A fresh copy of the defaults, read from server/config.default.lua: the only place they live.
---@return table
function UgInventory.Internal.Defaults()
    local ok, values, message = run(LoadResourceFile(RESOURCE, DEFAULT_FILE) or '', DEFAULT_FILE)

    if not ok or not values then
        error(('[ug-inventory] %s: %s'):format(DEFAULT_FILE, tostring(message)), 2)
    end

    return values
end

---Checks merged values. Returns clean copies of every valid key, and every error found.
---@param values table
---@return table clean
---@return string[] errors
function Config.Validate(values)
    local errors, clean, known, names = {}, {}, {}, {}

    for _, entry in ipairs(RULES) do
        known[entry.key] = true
        names[#names + 1] = entry.key

        local ok, checked, detail = Schema.Check(entry.rule, values[entry.key])

        if ok then
            clean[entry.key] = checked
        else
            local text = (detail or 'is invalid'):gsub('^value:? ?', '')

            errors[#errors + 1] = ('%s: %s'):format(entry.key, text)
        end
    end

    for key in pairs(values) do
        if not known[key] then
            local suggestion = type(key) == 'string' and UgLib.String.Suggest(key, names) or nil

            errors[#errors + 1] = ('unknown key "%s".%s'):format(tostring(key), suggestion and (' Did you mean "%s"?'):format(suggestion) or '')
        end
    end

    table.sort(errors)

    return clean, errors
end

---@type table?
local current = nil

---Reads, merges and checks config.lua, generating it from the example when missing. Publishes the values to clients.
---@return boolean ok
---@return string[] errors
function Config.Load()
    local content = LoadResourceFile(RESOURCE, OWNER_FILE)

    if content == nil then
        local example = LoadResourceFile(RESOURCE, DEFAULT_FILE)

        if example and SaveResourceFile(RESOURCE, OWNER_FILE, example, -1) then
            UgCore.Logger.Info('Generated %s.', OWNER_FILE)
        end

        content = example
    end

    local values = UgInventory.Internal.Defaults()

    if content then
        local ok, owner, message = run(content)

        if not ok or not owner then
            current = nil

            return false, { ('%s: %s'):format(OWNER_FILE, tostring(message)) }
        end

        for key, value in pairs(owner) do
            if MERGED[key] and type(value) == 'table' and type(values[key]) == 'table' then
                for field, fieldValue in pairs(value) do
                    values[key][field] = fieldValue
                end
            else
                values[key] = value
            end
        end
    end

    local clean, errors = Config.Validate(values)

    for index, message in ipairs(errors) do
        errors[index] = ('%s: %s'):format(OWNER_FILE, message)
    end

    current = #errors == 0 and clean or nil

    if current then
        GlobalState:set(STATE_KEY, current, true)
    end

    return current ~= nil, errors
end

---The loaded config. Raises before a successful Load.
---@return table
function Config.Get()
    if not current then
        error('[ug-inventory] Config.Get before a successful Config.Load', 2)
    end

    return current
end
