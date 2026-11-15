--[[

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

]] --

-- Last server script: waits for ug-core, loads config, then publishes where stashes stand. The page and every
-- inventory action go straight to ug-core, which checks them: this resource holds no inventory logic on the server.

local Config = UgInventory.Internal.Config
local Clothing = UgInventory.Internal.Clothing
local Garments = UgInventory.Internal.Garments
local ClothingMode = UgInventory.Enums.ClothingMode
local Logger = UgCore.Logger

local RESOURCE = GetCurrentResourceName()
local READY_TIMEOUT = 60000
local GlobalKeys = UgInventory.Enums.GlobalState
local Category = UgInventory.Enums.Category
-- Modules this resource needs, and the ones it uses when enabled.
local REQUIRED = { 'items', 'inventory' }

---Stashes with a position, for the open key. Their contents and access stay on the server.
---@return { name: string, label: string, coords: vector3 }[]
function UgInventory.Internal.StashPoints()
    local stashes = UgCore.Config.Get('inventory', 'stashes')
    local points = {}

    for name, stash in pairs(type(stashes) == 'table' and stashes or {}) do
        if type(stash) == 'table' and type(stash.coords) == 'vector3' then
            points[#points + 1] = {
                name = name,
                label = stash.label or name,
                coords = stash.coords,
            }
        end
    end

    table.sort(points, function(a, b)
        return a.name < b.name
    end)

    return points
end

---Clothing items in items mode, then weapons, their ammo, attachments and tints by item name, from ug-core's weapons
---config.
---@param config? table this resource's config
---@return table<string, UgInventoryCategory>
function UgInventory.Internal.Categories(config)
    local categories = {}

    if config and config.clothing and config.clothingMode == ClothingMode.Items then
        for _, piece in ipairs(config.clothingPieces) do
            categories[Garments.ItemOf(piece)] = Category.Clothing
        end
    end

    if not UgCore.Modules.IsEnabled('weapons') then
        return categories
    end

    local weapons = UgCore.Config.Get('weapons', 'weapons')
    local tints = UgCore.Config.Get('weapons', 'tints')

    for item in pairs(type(tints) == 'table' and tints or {}) do
        categories[item] = Category.Attachment
    end

    for name, weapon in pairs(type(weapons) == 'table' and weapons or {}) do
        if type(weapon) == 'table' then
            for item in pairs(type(weapon.components) == 'table' and weapon.components or {}) do
                categories[item] = Category.Attachment
            end

            if type(weapon.ammo) == 'string' then
                categories[weapon.ammo] = Category.Ammo
            end
        end

        categories[name] = Category.Weapon
    end

    return categories
end

CreateThread(function()
    if not UgCore.Lifecycle.Await(UgCore.Enums.Lifecycle.Ready, READY_TIMEOUT) then
        Logger.Error('ug-core did not become ready. ug-inventory stays off.')

        return
    end

    local ok, errors = Config.Load()

    if not ok then
        for _, message in ipairs(errors) do
            Logger.Error(message)
        end

        Logger.Error('Config invalid: %d error(s). ug-inventory stays off.', #errors)

        return
    end

    for _, name in ipairs(REQUIRED) do
        if not UgCore.Modules.IsEnabled(name) then
            Logger.Error('ug-inventory needs the %s module. Enable it in ug-core config/modules.lua.', name)

            return
        end
    end

    local config = Config.Get()
    local stashes = UgInventory.Internal.StashPoints()

    Clothing.Start(config)
    GlobalState:set(GlobalKeys.Stashes, stashes, true)
    GlobalState:set(GlobalKeys.Categories, UgInventory.Internal.Categories(config), true)

    print(('[ug-inventory] v%s ready. %d stash point(s), weapons %s, shops %s, clothing %s.'):format(
        GetResourceMetadata(RESOURCE, 'version', 0) or '?',
        #stashes,
        UgCore.Modules.IsEnabled('weapons') and 'on' or 'off',
        UgCore.Modules.IsEnabled('shops') and 'on' or 'off',
        config.clothing and config.clothingMode or 'off'
    ))
end)
