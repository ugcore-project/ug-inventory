--[[

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

]] --

-- The hotbar and the quick-use wheel. Keys 1 to N use slots 1 to N, and flash the hotbar. Holding the wheel key
-- shows slots 1 to N in a ring while the player keeps moving; releasing it over a slot uses that slot.

---@class UgInventory.Internal.Hotbar
local Hotbar = {}
UgInventory.Internal.Hotbar = Hotbar

local Nui = UgInventory.Internal.Nui
local State = UgInventory.Internal.State
local Screen = UgInventory.Internal.Screen
local Action = UgInventory.Enums.NuiAction
local Callback = UgInventory.Enums.NuiCallback

-- Controls from the Cfx controls reference: the weapon wheel (TAB), its scroll, and the weapon keys 1 to 9.
local WEAPON_CONTROLS = { 37, 14, 15, 157, 158, 159, 160, 161, 162, 163, 164, 165 }
-- Looking and shooting, kept off while the wheel follows the mouse.
local WHEEL_CONTROLS = { 1, 2, 24, 25, 14, 15 }
-- HUD components of the weapon wheel and its stats.
local WEAPON_WHEEL_HUD = { 19, 20 }
-- How long the page MAY take to answer a released wheel before it closes anyway.
local WHEEL_TIMEOUT_MS = 400

local wheelOpen = false
local wheelSlots = 0
local hotbarSlots = 0
local busy = false

---Slots 1 to `count` of the player inventory, empty ones left out, with their labels: the page MAY not have the
---definitions yet when the screen was never opened.
---@param count integer
---@return table[]
local function slots(count)
    local list = {}
    local definitions = UgCore.Items.GetAll()

    for slot = 1, count do
        local item = UgCore.Inventory.GetSlot(slot) --[[@as table?]]

        if item then
            local definition = definitions[item.name]

            item.label = definition and definition.label or item.name
            list[#list + 1] = item
        end
    end

    return list
end

---Uses a slot of the player inventory. One use at a time: ug-core rate limits uses too.
---@param slot integer
function Hotbar.Use(slot)
    if busy or not UgCore.Inventory.GetSlot(slot) then
        return
    end

    busy = true
    State.ExpectEquip(slot)

    CreateThread(function()
        UgCore.Inventory.Use(slot)
        busy = false
    end)
end

---@param slot integer
local function press(slot)
    if Screen.IsOpen() or wheelOpen then
        return
    end

    Nui.Send(Action.Hotbar, {
        active = slot,
        items = slots(hotbarSlots),
    })
    Hotbar.Use(slot)
end

local function closeWheel()
    if not wheelOpen then
        return
    end

    wheelOpen = false
    SetNuiFocusKeepInput(false)
    SetNuiFocus(false, false)
end

local function openWheel()
    if wheelOpen or Screen.IsOpen() or wheelSlots == 0 or IsPauseMenuActive() then
        return
    end

    wheelOpen = true
    Nui.Send(Action.Wheel, {
        items = slots(wheelSlots),
        slots = wheelSlots,
    })
    SetNuiFocus(true, true)
    -- The player keeps walking while choosing.
    SetNuiFocusKeepInput(true)

    CreateThread(function()
        while wheelOpen do
            for _, control in ipairs(WHEEL_CONTROLS) do
                DisableControlAction(0, control, true)
            end

            Wait(0)
        end
    end)
end

local function releaseWheel()
    if not wheelOpen then
        return
    end

    Nui.Send(Action.WheelClose)

    SetTimeout(WHEEL_TIMEOUT_MS, closeWheel)
end

Nui.On(Callback.WheelPick, function(value)
    if not wheelOpen then
        return
    end

    closeWheel()

    if value.slot > 0 and value.slot <= wheelSlots then
        Hotbar.Use(value.slot)
    end
end)

---Hides the GTA weapon wheel every frame: weapons are items, chosen from the inventory.
local function hideWeaponWheel()
    CreateThread(function()
        while true do
            for _, control in ipairs(WEAPON_CONTROLS) do
                DisableControlAction(0, control, true)
            end

            for _, component in ipairs(WEAPON_WHEEL_HUD) do
                HideHudComponentThisFrame(component)
            end

            Wait(0)
        end
    end)
end

---Registers the keys. Called once ug-core is ready.
---@param settings table the replicated config
---@param label fun(key: string, vars?: table): string
function Hotbar.Start(settings, label)
    hotbarSlots = settings.hotbarSlots or 0
    wheelSlots = settings.wheelSlots or 0

    for slot = 1, hotbarSlots do
        UgLib.Keybind.Register({
            name = 'slot' .. slot,
            label = label('keybind.slot', {
                slot = slot,
            }),
            defaultKey = tostring(slot),
            onPressed = function()
                press(slot)
            end,
        })
    end

    if wheelSlots > 0 then
        UgLib.Keybind.Register({
            name = 'wheel',
            label = label('keybind.wheel'),
            defaultKey = settings.wheelKey,
            onPressed = openWheel,
            onReleased = releaseWheel,
        })
    end

    if settings.disableWeaponWheel ~= false then
        hideWeaponWheel()
    end
end
