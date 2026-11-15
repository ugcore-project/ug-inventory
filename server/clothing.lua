--[[

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

]] --

-- Clothing in items mode: a piece comes off as an item and goes back on when the item is used. ug-appearance owns
-- what a character wears and saves it: a piece moves between the appearance and the inventory, never exists twice.
-- Toggle mode needs nothing here: the client changes its own ped.

---@class UgInventory.Internal.Clothing
local Clothing = {}
UgInventory.Internal.Clothing = Clothing

local Garments = UgInventory.Internal.Garments
local ClothingMode = UgInventory.Enums.ClothingMode
local Schema = UgCore.Schema
local Errors = UgCore.Enums.Errors
local Logger = UgCore.Logger

local RESOURCE = GetCurrentResourceName()
local APPEARANCE = 'ug-appearance'
local DRESSED_EVENT = RESOURCE .. ':Dressed'
local REASON = RESOURCE .. ':clothing'
-- Grams per clothing item.
local WEIGHT = 300

---@class UgInventoryClothingWorn
---@field model string
---@field components table<string, { drawable: integer, texture: integer }>
---@field props table<string, { drawable: integer, texture: integer }>

---@class UgInventoryClothingMetadata
---@field model string
---@field drawable integer
---@field texture integer

local METADATA = Schema.Object({
    model = Schema.String({
        min = 1,
        max = 64,
        pattern = '^[%w_]+$',
    }),
    drawable = Schema.Integer({
        min = 0,
        max = 4095,
    }),
    texture = Schema.Integer({
        min = 0,
        max = 255,
    }),
})

---@type table<string, table<string, integer>>
local naked = {}
---@type table<integer, true> players with a clothing change running: one at a time, or a piece could come off twice
local busy = {}

---@return boolean
local function appearanceStarted()
    return GetResourceState(APPEARANCE) == 'started'
end

---What the player's character wears, from ug-appearance. Runs in a thread.
---@param source integer
---@return UgInventoryClothingWorn?
local function worn(source)
    local ok, value = pcall(function()
        return exports[APPEARANCE]:GetClothing(source)
    end)

    return ok and type(value) == 'table' and value or nil
end

---Saves pieces through ug-appearance, which dresses the ped. Runs in a thread.
---@param source integer
---@param parts { components?: table, props?: table }
---@return boolean ok
---@return UgErrorCode? errorCode
local function dress(source, parts)
    local called, ok, errorCode = pcall(function()
        return exports[APPEARANCE]:SetClothing(source, parts)
    end)

    if not called then
        return false, Errors.InternalError
    end

    return ok == true, ok ~= true and (errorCode or Errors.InternalError) or nil
end

---The parts table that sets one piece.
---@param piece UgInventoryClothingPiece
---@param drawable integer
---@param texture integer
---@return table
local function partsOf(piece, drawable, texture)
    local definition = Garments.Pieces[piece]
    local group = definition.kind == 'prop' and 'props' or 'components'

    return {
        [group] = {
            [definition.key] = {
                drawable = drawable,
                texture = texture,
            },
        },
    }
end

---The piece the character wears now, nil when it wears none.
---@param clothes UgInventoryClothingWorn
---@param piece UgInventoryClothingPiece
---@return UgInventoryClothingMetadata?
---@return integer? off the drawable without the piece, nil for models without one
local function current(clothes, piece)
    local definition = Garments.Pieces[piece]
    local off = Garments.Naked(clothes.model, piece, naked)
    local group = definition.kind == 'prop' and clothes.props or clothes.components
    local part = type(group) == 'table' and group[definition.key] or nil

    if off == nil or type(part) ~= 'table' or part.drawable == off or math.type(part.drawable) ~= 'integer' then
        return nil, off
    end

    return {
        model = clothes.model,
        drawable = part.drawable,
        texture = math.type(part.texture) == 'integer' and part.texture or 0,
    }, off
end

---Runs a change while no other change of that player runs.
---@param source integer
---@param run fun(): boolean, UgErrorCode?
---@return boolean ok
---@return UgErrorCode? errorCode
local function exclusive(source, run)
    if busy[source] then
        return false, Errors.RateLimited
    end

    busy[source] = true

    local called, ok, errorCode = pcall(run)

    busy[source] = nil

    if not called then
        Logger.Error('Clothing: %s', tostring(ok))

        return false, Errors.InternalError
    end

    return ok, errorCode
end

---Takes a piece off into the inventory. The item comes first: a piece that does not fit stays on.
---@param source integer
---@param piece UgInventoryClothingPiece validated
---@return boolean ok
---@return UgErrorCode? errorCode
function Clothing.TakeOff(source, piece)
    return exclusive(source, function()
        if not appearanceStarted() then
            return false, Errors.NotFound
        end

        local clothes = worn(source)

        if not clothes then
            return false, Errors.NotLoaded
        end

        local metadata, off = current(clothes, piece)

        if not metadata or not off then
            return false, Errors.NotFound
        end

        local item = Garments.ItemOf(piece)
        local added, addError = UgCore.Inventory.AddItem(source, item, 1, metadata, REASON)

        if not added then
            return false, addError
        end

        local ok, errorCode = dress(source, partsOf(piece, off, 0))

        if not ok then
            UgCore.Inventory.RemoveItem(source, item, 1, metadata, REASON)

            return false, errorCode
        end

        UgCore.Network.TriggerClient(source, DRESSED_EVENT, piece)

        return true, nil
    end)
end

---Wears a clothing item. A piece worn in its place comes off into the inventory. Every step is undone on failure.
---@param source integer
---@param piece UgInventoryClothingPiece
---@param item { slot: integer, name: string, metadata?: table }
---@return boolean ok
function Clothing.Wear(source, piece, item)
    local ok = exclusive(source, function()
        local checked, metadata = Schema.Check(METADATA, item.metadata)

        if not checked or not appearanceStarted() then
            return false, Errors.InvalidArgs
        end

        local clothes = worn(source)

        -- A piece made for another body does not fit.
        if not clothes or clothes.model ~= metadata.model then
            return false, Errors.InvalidArgs
        end

        local old, off = current(clothes, piece)

        if not off then
            return false, Errors.InvalidArgs
        end

        local name = Garments.ItemOf(piece)

        if not UgCore.Inventory.RemoveFromSlot(source, item.slot, 1, REASON) then
            return false, Errors.NotFound
        end

        if old and not UgCore.Inventory.AddItem(source, name, 1, old, REASON) then
            UgCore.Inventory.AddItem(source, name, 1, metadata, REASON)

            return false, Errors.CannotCarry
        end

        if not dress(source, partsOf(piece, metadata.drawable, metadata.texture)) then
            if old then
                UgCore.Inventory.RemoveItem(source, name, 1, old, REASON)
            end

            UgCore.Inventory.AddItem(source, name, 1, metadata, REASON)

            return false, Errors.InternalError
        end

        UgCore.Network.TriggerClient(source, DRESSED_EVENT, piece)

        return true, nil
    end)

    return ok
end

---Registers clothing items, their use and the take-off callback, in items mode. Runs once, after the config loaded.
---@param config table
---@return boolean started
function Clothing.Start(config)
    if not config.clothing or config.clothingMode ~= ClothingMode.Items or #config.clothingPieces == 0 then
        return false
    end

    naked = config.clothingNaked or {}

    if not appearanceStarted() then
        Logger.Warn('clothingMode is "items": start ug-appearance before ug-inventory. Pieces cannot come off without it.')
    end

    for _, piece in ipairs(config.clothingPieces) do
        local name = Garments.ItemOf(piece)

        UgCore.Items.Register(name, {
            label = Garments.Pieces[piece].label,
            weight = WEIGHT,
            stack = false,
            description = 'Clothing. Use it, or drag it onto its slot, to wear it.',
            metadata = METADATA,
        })
        UgCore.Items.RegisterUse(name, function(source, item)
            return Clothing.Wear(source, piece, item)
        end, {
            consume = 0,
        })
    end

    UgCore.Callback.Register('TakeOff', {
        schema = Schema.Define({ Schema.Enum(config.clothingPieces) }),
        rate = {
            max = 3,
            per = 2000,
        },
        requirePlayer = true,
        requireAlive = true,
    }, function(source, piece)
        local ok, errorCode = Clothing.TakeOff(source, piece)

        return {
            ok = ok,
            error = errorCode,
        }
    end)

    AddEventHandler('playerDropped', function()
        busy[source --[[@as integer]]] = nil
    end)

    return true
end
