--[[

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

]] --

-- Mirrors ug-core's client inventory to the page. ug-core receives every change from the server: this file only
-- reshapes it, keeps the page current while it is open, and turns count changes into toasts.

---@class UgInventory.Internal.State
local State = {}
UgInventory.Internal.State = State

local Nui = UgInventory.Internal.Nui
local Enums = UgInventory.Enums
local Action = Enums.NuiAction
local Side = Enums.Side

---@type table<string, integer>? units per item name, nil before the first sync
local counts = nil
---@type string? serial of the weapon in hand
local equippedSerial = nil
---@type string? serial of the weapon a use is about to equip
local pendingSerial = nil
local toasts = true

---Item definitions the page needs to show items: label, weight, stacking, description, category.
---@return table<string, { label: string, weight: integer, stack: boolean, maxStack: integer, description?: string, usable: boolean, category: UgInventoryCategory }>
function State.Definitions()
    local definitions = {}
    local published = GlobalState[Enums.GlobalState.Categories]
    local categories = type(published) == 'table' and published or {}

    for name, definition in pairs(UgCore.Items.GetAll()) do
        local usable = definition.usable == true

        definitions[name] = {
            label = definition.label,
            weight = definition.weight,
            stack = definition.stack,
            maxStack = definition.maxStack,
            description = definition.description,
            usable = usable,
            category = categories[name] or (usable and Enums.Category.Consumable or Enums.Category.Item),
        }
    end

    return definitions
end

---The player inventory as the page shows it.
---@return { slots: integer, maxWeight: integer, items: UgInventorySlot[] }
function State.Player()
    return {
        slots = UgCore.Inventory.GetSlots(),
        maxWeight = UgCore.Inventory.GetMaxWeight(),
        items = UgCore.Inventory.GetItems(),
    }
end

---@return string?
function State.GetEquipped()
    return equippedSerial
end

---Called before a use: when it equips a weapon, the page highlights that weapon by its serial.
---@param slot integer
function State.ExpectEquip(slot)
    local item = UgCore.Inventory.GetSlot(slot)
    local serial = item and item.metadata and item.metadata.serial

    pendingSerial = type(serial) == 'string' and serial or nil
end

---@return table<string, integer>
local function countAll()
    local list = {}

    for _, item in ipairs(UgCore.Inventory.GetItems()) do
        list[item.name] = (list[item.name] or 0) + item.count
    end

    return list
end

---Toasts for every item whose count changed since the last change.
local function toastChanges()
    local now = countAll()
    local before = counts

    counts = now

    if not before or not toasts then
        return
    end

    local definitions = UgCore.Items.GetAll()
    local changed = {}

    for name, count in pairs(now) do
        if count ~= (before[name] or 0) then
            changed[#changed + 1] = name
        end
    end

    for name in pairs(before) do
        if not now[name] then
            changed[#changed + 1] = name
        end
    end

    -- Stable order, so a change of several items shows the same way each time.
    table.sort(changed)

    local list = {}

    for _, name in ipairs(changed) do
        local definition = definitions[name]

        list[#list + 1] = {
            name = name,
            label = definition and definition.label or name,
            delta = (now[name] or 0) - (before[name] or 0),
        }
    end

    if #list > 0 then
        Nui.Send(Action.Toast, list)
    end
end

---@param applied { slot: integer, item?: UgInventoryItem }[]?
---@param ref string
local function onChanged(applied, ref)
    if ref == Side.Other then
        if applied then
            Nui.Send(Action.Update, {
                side = Side.Other,
                changes = applied,
            })
        end

        return
    end

    -- No list means the server sent the whole inventory: a character loaded, or a refresh. No toasts for that.
    if not applied then
        counts = countAll()
        Nui.Send(Action.Update, {
            side = Side.Player,
            inventory = State.Player(),
        })

        return
    end

    Nui.Send(Action.Update, {
        side = Side.Player,
        changes = applied,
    })
    toastChanges()
end

---Starts mirroring. Called once ug-core is ready.
---@param settings table the replicated config
function State.Start(settings)
    local Events = UgCore.Events
    local InventoryEvents = UgCore.Enums.Events.Inventory

    toasts = settings.toasts ~= false

    if UgCore.Inventory.IsLoaded() then
        counts = countAll()
    end

    Events.On(InventoryEvents.Changed, onChanged)

    Events.On(InventoryEvents.Closed, function()
        Nui.Send(Action.OtherClosed)
    end)

    if UgCore.Modules.IsEnabled('weapons') then
        local WeaponEvents = UgCore.Enums.Events.Weapons

        Events.On(WeaponEvents.Equipped, function()
            equippedSerial, pendingSerial = pendingSerial, nil
            Nui.Send(Action.Equipped, {
                serial = equippedSerial,
                armed = true,
            })
        end)

        Events.On(WeaponEvents.Unequipped, function()
            equippedSerial = nil
            Nui.Send(Action.Equipped, {
                armed = false,
            })
        end)
    end
end
