--[[

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

]] --

-- Ground drops as props. ug-core replicates where drops are; each client shows a local, non-networked prop at the
-- ones near it, so nothing is created on the server and nobody can move them.

---@class UgInventory.Internal.Drops
local Drops = {}
UgInventory.Internal.Drops = Drops

local REFRESH_MS = 1000

---@type table<string, integer> props by drop id
local props = {}
local model = 'prop_paper_bag_small'
local renderDistance = 40.0

---@param id string
local function remove(id)
    local prop = props[id]

    if prop and DoesEntityExist(prop) then
        DeleteEntity(prop)
    end

    props[id] = nil
end

---@param position vector3
---@return integer? prop
local function spawn(position)
    if not UgLib.Streaming.Model(model) then
        return nil
    end

    local prop = CreateObject(joaat(model), position.x, position.y, position.z, false, false, false)

    PlaceObjectOnGroundProperly(prop)
    FreezeEntityPosition(prop, true)
    SetEntityCollision(prop, false, false)
    SetModelAsNoLongerNeeded(joaat(model))

    return prop
end

---Adds props for drops that came into range, and removes those of drops that left it or are gone.
function Drops.Refresh()
    local coords = GetEntityCoords(PlayerPedId())
    local drops = UgCore.Inventory.GetDrops()

    for id in pairs(props) do
        local position = drops[id]

        if not position or #(position - coords) > renderDistance then
            remove(id)
        end
    end

    for id, position in pairs(drops) do
        if not props[id] and #(position - coords) <= renderDistance then
            props[id] = spawn(position)
        end
    end
end

---Starts showing drops. Called once ug-core is ready.
---@param settings table the replicated config
function Drops.Start(settings)
    model = settings.dropModel or model
    renderDistance = settings.dropRenderDistance or renderDistance

    CreateThread(function()
        while true do
            Drops.Refresh()
            Wait(REFRESH_MS)
        end
    end)
end

AddEventHandler('onResourceStop', function(resource)
    if resource == GetCurrentResourceName() then
        for id in pairs(props) do
            remove(id)
        end
    end
end)
