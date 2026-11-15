--[[

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

]] --

-- Clothing slots next to the character. What is worn is read from the ped, so the slots match whatever dressed it.
-- Toggle mode changes the ped here and remembers each piece to put it back. Items mode asks the server, which moves
-- the piece between ug-appearance and the inventory, then tells this client to play the animation.

---@class UgInventory.Internal.Wardrobe
local Wardrobe = {}
UgInventory.Internal.Wardrobe = Wardrobe

local Garments = UgInventory.Internal.Garments
local Nui = UgInventory.Internal.Nui
local Preview = UgInventory.Internal.Preview
local Enums = UgInventory.Enums
local Mode = Enums.ClothingMode
local Errors = UgCore.Enums.Errors

local TAKE_OFF = GetCurrentResourceName() .. ':TakeOff'
local LOAD_TIMEOUT_MS = 1000
-- Time ug-appearance needs to dress the ped after the server saved a piece, before the slots read it again.
local SETTLE_MS = 500
-- Animation flags: upper body only, so the player keeps moving, or the whole body.
local UPPER_BODY = 48
local FULL_BODY = 0

---@class UgInventoryClothingAnimation
---@field dict string
---@field name string
---@field duration integer ms; the piece changes halfway
---@field upperBody? boolean false plays on the whole body

-- Owner config clothingAnimations: what the player does while a piece comes off or goes on. A missing one plays
-- nothing. The default dictionaries MUST be checked on a live server.
---@type table<UgInventoryClothingPiece, UgInventoryClothingAnimation>
local animations = {}

---@class UgInventoryClothingSlot
---@field piece UgInventoryClothingPiece
---@field worn boolean
---@field available boolean the ped's model has a known drawable without the piece
---@field restorable boolean toggle mode: the piece is off and can go back on
---@field item? string items mode: the item the piece comes off as

local enabled = false
---@type UgInventoryClothingMode
local mode = Mode.Toggle
---@type UgInventoryClothingPiece[]
local pieces = {}
---@type table<UgInventoryClothingPiece, true>
local shown = {}
---@type table<string, table<string, integer>>
local naked = {}
---@type table<integer, string> model names by hash
local models = {}
---@type table<UgInventoryClothingPiece, { drawable: integer, texture: integer, model: integer }> toggle mode
local remembered = {}
local changing = false

---@param ped integer
---@param definition UgInventoryClothingDefinition
---@return integer drawable
---@return integer texture
local function read(ped, definition)
    if definition.kind == 'prop' then
        return GetPedPropIndex(ped, definition.id), GetPedPropTextureIndex(ped, definition.id)
    end

    return GetPedDrawableVariation(ped, definition.id), GetPedTextureVariation(ped, definition.id)
end

---@param ped integer
---@param definition UgInventoryClothingDefinition
---@param drawable integer
---@param texture integer
local function apply(ped, definition, drawable, texture)
    if definition.kind == 'component' then
        SetPedComponentVariation(ped, definition.id, drawable, texture, 0)
    elseif drawable < 0 then
        ClearPedProp(ped, definition.id)
    else
        SetPedPropIndex(ped, definition.id, drawable, texture, true)
    end
end

---The drawable without the piece for the ped's model, nil when the model has none.
---@param ped integer
---@param piece UgInventoryClothingPiece
---@return integer?
local function offOf(ped, piece)
    return Garments.Naked(models[GetEntityModel(ped)] or '', piece, naked)
end

---Plays a piece's animation on the player. Returns the ms until the piece SHOULD change. Runs in a thread.
---@param piece UgInventoryClothingPiece
---@return integer
local function animate(piece)
    local animation = animations[piece]
    local ped = PlayerPedId()

    if not animation or IsPedInAnyVehicle(ped, false) then
        return 0
    end

    RequestAnimDict(animation.dict)

    local deadline = GetGameTimer() + LOAD_TIMEOUT_MS

    while not HasAnimDictLoaded(animation.dict) do
        if GetGameTimer() >= deadline then
            return 0
        end

        Wait(0)
    end

    TaskPlayAnim(ped, animation.dict, animation.name, 3.0, 3.0, animation.duration, animation.upperBody == false and FULL_BODY or UPPER_BODY, 0.0, false, false, false)
    RemoveAnimDict(animation.dict)

    return animation.duration // 2
end

---What the slots show now. Nil when clothing is off.
---@return { mode: UgInventoryClothingMode, pieces: UgInventoryClothingSlot[] }?
function Wardrobe.State()
    if not enabled then
        return nil
    end

    local ped = PlayerPedId()
    local model = GetEntityModel(ped)
    local list = {}

    for _, piece in ipairs(pieces) do
        local off = offOf(ped, piece)
        local worn = off ~= nil and read(ped, Garments.Pieces[piece]) ~= off
        local kept = remembered[piece]

        list[#list + 1] = {
            piece = piece,
            worn = worn,
            available = off ~= nil,
            restorable = mode == Mode.Toggle and not worn and kept ~= nil and kept.model == model,
            item = mode == Mode.Items and Garments.ItemOf(piece) or nil,
        }
    end

    return {
        mode = mode,
        pieces = list,
    }
end

---Sends the slots to the page and shows the change on the preview.
local function refresh()
    Nui.Send(Enums.NuiAction.Clothing, Wardrobe.State())
    Preview.Refresh()
end

---Takes a piece off, or puts it back on in toggle mode. Runs in a thread.
---@param piece UgInventoryClothingPiece
---@return boolean ok
---@return UgErrorCode? errorCode
function Wardrobe.Toggle(piece)
    if not enabled or not shown[piece] then
        return false, Errors.InvalidArgs
    end

    if changing then
        return false, Errors.RateLimited
    end

    local ped = PlayerPedId()
    local definition = Garments.Pieces[piece]
    local off = offOf(ped, piece)

    if off == nil then
        return false, Errors.NotFound
    end

    local drawable, texture = read(ped, definition)
    local worn = drawable ~= off

    if mode == Mode.Items then
        if not worn then
            return false, Errors.NotFound
        end

        changing = true

        local ok, value, errorCode = UgCore.Callback.Await(TAKE_OFF, piece)

        changing = false

        if not ok then
            return false, errorCode or Errors.InternalError
        end

        if type(value) ~= 'table' or value.ok ~= true then
            return false, type(value) == 'table' and type(value.error) == 'string' and value.error or Errors.InternalError
        end

        return true, nil
    end

    local model = GetEntityModel(ped)
    local target = nil

    if worn then
        target = {
            drawable = off,
            texture = 0,
        }
        remembered[piece] = {
            drawable = drawable,
            texture = texture,
            model = model,
        }
    elseif remembered[piece] and remembered[piece].model == model then
        target = remembered[piece]
        remembered[piece] = nil
    else
        return false, Errors.NotFound
    end

    changing = true
    Wait(animate(piece))
    apply(PlayerPedId(), definition, target.drawable, target.texture)
    changing = false
    refresh()

    return true, nil
end

---@param settings table the replicated config
function Wardrobe.Start(settings)
    pieces = settings.clothing ~= false and settings.clothingPieces or {}
    enabled = #pieces > 0
    mode = settings.clothingMode or Mode.Toggle
    naked = settings.clothingNaked or {}
    animations = type(settings.clothingAnimations) == 'table' and settings.clothingAnimations or {}

    for _, piece in ipairs(pieces) do
        shown[piece] = true
    end

    for _, name in ipairs(Garments.Models(naked)) do
        models[joaat(name)] = name
    end

    if enabled and mode == Mode.Items then
        UgCore.Network.Register('Dressed', function(piece)
            if not shown[piece] then
                return
            end

            CreateThread(function()
                animate(piece)
                Wait(SETTLE_MS)
                refresh()
            end)
        end)
    end
end

-- Toggle mode: pieces taken off go back on when the resource stops.
AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then
        return
    end

    local ped = PlayerPedId()
    local model = GetEntityModel(ped)

    for piece, part in pairs(remembered) do
        if part.model == model then
            apply(ped, Garments.Pieces[piece], part.drawable, part.texture)
        end
    end
end)
