--[[

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

]] --

-- The clothing pieces the screen shows next to the character: which ped component or prop each one is, its key in
-- ug-appearance's appearance, and what the ped wears once it is off. Server and client read the same table.

---@class UgInventoryClothingDefinition
---@field kind 'component'|'prop'
---@field id integer native component or prop id
---@field key string the piece in ug-appearance's `components` or `props`
---@field label string English item label, for the item of items mode
---@field naked? table<string, integer> components only: drawable worn without the piece, by model

---@class UgInventory.Internal.Garments
local Garments = {}
UgInventory.Internal.Garments = Garments

local Piece = UgInventory.Enums.ClothingPiece

local MALE = 'mp_m_freemode_01'
local FEMALE = 'mp_f_freemode_01'
-- Props are off at -1, for every model.
local NO_PROP = -1
local ITEM_PREFIX = 'clothing_'

-- Drawables without the piece come from the base game: add-on clothing packs append, they never move these.
-- Values marked (live) MUST be checked on a live server. Owners MAY change any of them with `clothingNaked`.
---@type table<UgInventoryClothingPiece, UgInventoryClothingDefinition>
Garments.Pieces = {
    [Piece.Hat] = {
        kind = 'prop',
        id = 0,
        key = 'hat',
        label = 'Hat',
    },
    [Piece.Glasses] = {
        kind = 'prop',
        id = 1,
        key = 'glasses',
        label = 'Glasses',
    },
    [Piece.Ears] = {
        kind = 'prop',
        id = 2,
        key = 'ears',
        label = 'Earrings',
    },
    [Piece.Watch] = {
        kind = 'prop',
        id = 6,
        key = 'watch',
        label = 'Watch',
    },
    [Piece.Bracelet] = {
        kind = 'prop',
        id = 7,
        key = 'bracelet',
        label = 'Bracelet',
    },
    [Piece.Mask] = {
        kind = 'component',
        id = 1,
        key = 'mask',
        label = 'Mask',
        naked = {
            [MALE] = 0,
            [FEMALE] = 0,
        },
    },
    [Piece.Gloves] = {
        kind = 'component',
        id = 3,
        key = 'arms',
        label = 'Gloves',
        naked = {
            [MALE] = 15,
            [FEMALE] = 15,
        },
    },
    -- (live) underwear.
    [Piece.Legs] = {
        kind = 'component',
        id = 4,
        key = 'legs',
        label = 'Pants',
        naked = {
            [MALE] = 61,
            [FEMALE] = 14,
        },
    },
    [Piece.Bag] = {
        kind = 'component',
        id = 5,
        key = 'bag',
        label = 'Bag',
        naked = {
            [MALE] = 0,
            [FEMALE] = 0,
        },
    },
    -- (live) bare feet.
    [Piece.Shoes] = {
        kind = 'component',
        id = 6,
        key = 'shoes',
        label = 'Shoes',
        naked = {
            [MALE] = 34,
            [FEMALE] = 35,
        },
    },
    [Piece.Chain] = {
        kind = 'component',
        id = 7,
        key = 'accessory',
        label = 'Chain',
        naked = {
            [MALE] = 0,
            [FEMALE] = 0,
        },
    },
    -- (live) no undershirt.
    [Piece.Undershirt] = {
        kind = 'component',
        id = 8,
        key = 'undershirt',
        label = 'Undershirt',
        naked = {
            [MALE] = 15,
            [FEMALE] = 14,
        },
    },
    [Piece.Vest] = {
        kind = 'component',
        id = 9,
        key = 'armor',
        label = 'Vest',
        naked = {
            [MALE] = 0,
            [FEMALE] = 0,
        },
    },
    [Piece.Top] = {
        kind = 'component',
        id = 11,
        key = 'top',
        label = 'Top',
        naked = {
            [MALE] = 15,
            [FEMALE] = 15,
        },
    },
}

---Every model with known drawables: the freemode models and the owner's.
---@param overrides? table<string, table<string, integer>> `clothingNaked`
---@return string[] models sorted by name
function Garments.Models(overrides)
    local seen, list = {
        [MALE] = true,
        [FEMALE] = true,
    }, { MALE, FEMALE }

    for model in pairs(overrides or {}) do
        if not seen[model] then
            seen[model] = true
            list[#list + 1] = model
        end
    end

    table.sort(list)

    return list
end

---The drawable a model wears without a piece, nil when the piece has no known value for that model.
---@param model string
---@param piece UgInventoryClothingPiece
---@param overrides? table<string, table<string, integer>> `clothingNaked`
---@return integer?
function Garments.Naked(model, piece, overrides)
    local definition = Garments.Pieces[piece]

    if not definition then
        return nil
    end

    if definition.kind == 'prop' then
        return NO_PROP
    end

    local owner = overrides and overrides[model]

    if owner and owner[piece] ~= nil then
        return owner[piece]
    end

    return definition.naked and definition.naked[model] or nil
end

---The item a piece comes off as, in items mode.
---@param piece UgInventoryClothingPiece
---@return string
function Garments.ItemOf(piece)
    return ITEM_PREFIX .. piece
end

---The piece an item is, nil for every other item.
---@param name string
---@return UgInventoryClothingPiece?
function Garments.PieceOf(name)
    if name:sub(1, #ITEM_PREFIX) ~= ITEM_PREFIX then
        return nil
    end

    local piece = name:sub(#ITEM_PREFIX + 1)

    return Garments.Pieces[piece] and piece --[[@as UgInventoryClothingPiece]] or nil
end
