--[[

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

]] --

-- The open key and the exports. The key opens the inventory with the closest thing in reach next to it: the
-- glovebox of the car the player sits in, else the closest trunk, ground drop, stash or shop. ug-core checks reach
-- and access again: what is found here only chooses what to ask for.

---@class UgInventory.Internal.Open
local Open = {}
UgInventory.Internal.Open = Open

local Screen = UgInventory.Internal.Screen
local Kind = UgInventory.Enums.Kind

local STASHES_KEY = UgInventory.Enums.GlobalState.Stashes
-- Vehicles farther than this are never checked for a trunk.
local VEHICLE_SEARCH = 8.0
-- Lock states of GetVehicleDoorLockStatus that keep doors closed: locked, and locked for players.
local LOCKED = {
    [2] = true,
    [4] = true,
    [10] = true,
}

local settings = {
    trunkDistance = 1.5,
    dropDistance = 2.0,
    stashDistance = 2.0,
    shopDistance = 2.5,
    respectLocks = true,
}

---@param vehicle integer
---@return boolean
local function isLocked(vehicle)
    return settings.respectLocks and LOCKED[GetVehicleDoorLockStatus(vehicle)] == true
end

---Where a vehicle's trunk is: its boot bone, or the middle of its rear for models without one.
---@param vehicle integer
---@return vector3
local function trunkOf(vehicle)
    local bone = GetEntityBoneIndexByName(vehicle, 'boot')

    if bone ~= -1 then
        return GetWorldPositionOfEntityBone(vehicle, bone)
    end

    local minimum = GetModelDimensions(GetEntityModel(vehicle))

    return GetOffsetFromEntityInWorldCoords(vehicle, 0.0, minimum.y, 0.0)
end

---@class UgInventoryCandidate : UgInventoryTarget
---@field distance number

---@param best UgInventoryCandidate?
---@param kind UgInventoryKind
---@param key string|integer
---@param distance number
---@param limit number
---@param label? string
---@return UgInventoryCandidate?
local function closer(best, kind, key, distance, limit, label)
    if distance > limit or (best and best.distance <= distance) then
        return best
    end

    return {
        kind = kind,
        key = key,
        distance = distance,
        label = label,
    }
end

---What the open key opens next to the player inventory, or nil for the inventory alone.
---@return UgInventoryTarget?
function Open.FindTarget()
    local ped = PlayerPedId()
    local seated = GetVehiclePedIsIn(ped, false)

    if seated ~= 0 then
        return {
            kind = Kind.Glovebox,
            key = seated,
        }
    end

    local coords = GetEntityCoords(ped)
    ---@type UgInventoryCandidate?
    local best = nil

    for id, position in pairs(UgCore.Inventory.GetDrops()) do
        best = closer(best, Kind.Drop, id, #(position - coords), settings.dropDistance)
    end

    for _, vehicle in ipairs(GetGamePool('CVehicle')) do
        if #(GetEntityCoords(vehicle) - coords) <= VEHICLE_SEARCH and not isLocked(vehicle) then
            best = closer(best, Kind.Trunk, vehicle, #(trunkOf(vehicle) - coords), settings.trunkDistance)
        end
    end

    local stashes = GlobalState[STASHES_KEY]

    for _, stash in ipairs(type(stashes) == 'table' and stashes or {}) do
        best = closer(best, Kind.Stash, stash.name, #(stash.coords - coords), settings.stashDistance, stash.label)
    end

    if UgCore.Modules.IsEnabled('shops') then
        for name, shop in pairs(UgCore.Shops.GetAll()) do
            for _, point in ipairs(shop.coords) do
                best = closer(best, Kind.Shop, name, #(point - coords), settings.shopDistance, shop.label)
            end
        end
    end

    if not best then
        return nil
    end

    return {
        kind = best.kind,
        key = best.key,
        label = best.label,
    }
end

---Opens the screen, or closes it when it is open.
function Open.Toggle()
    if Screen.IsOpen() then
        Screen.Close()
    else
        Screen.Open(Open.FindTarget())
    end
end

---@param values table the replicated config
function Open.Start(values)
    for key in pairs(settings) do
        if values[key] ~= nil then
            settings[key] = values[key]
        end
    end
end

---@param kind UgInventoryKind
---@param key string|integer
---@param check fun(key: any): boolean
local function openAs(kind, key, check)
    if check(key) then
        Screen.Open({
            kind = kind,
            key = key,
        })
    end
end

---@param value any
---@return boolean
local function isName(value)
    return type(value) == 'string' and #value > 0 and #value <= 64
end

---@param value any
---@return boolean
local function isVehicle(value)
    return math.type(value) == 'integer' and DoesEntityExist(value) and GetEntityType(value) == 2
end

-- Other resources (ug-target, jobs, housing) open the screen with these. ug-core still checks reach and access.
exports('Open', function()
    Screen.Open(nil)
end)

exports('OpenStash', function(name)
    openAs(Kind.Stash, name, isName)
end)

exports('OpenTrunk', function(vehicle)
    openAs(Kind.Trunk, vehicle, isVehicle)
end)

exports('OpenGlovebox', function(vehicle)
    openAs(Kind.Glovebox, vehicle, isVehicle)
end)

exports('OpenDrop', function(id)
    openAs(Kind.Drop, id, isName)
end)

exports('OpenShop', function(name)
    openAs(Kind.Shop, name, isName)
end)

exports('Close', function()
    Screen.Close()
end)

exports('IsOpen', function()
    return Screen.IsOpen()
end)
