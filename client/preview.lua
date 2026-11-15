--[[

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

]] --

-- The character preview: while the inventory is open, an empty frontend menu shows a copy of the player ped, the way
-- the pause menu shows it. The copy is local, hidden in the world, and deleted on close. Nothing moves the player.

---@class UgInventory.Internal.Preview
local Preview = {}
UgInventory.Internal.Preview = Preview

-- The empty pause menu. Its NO_BACKGROUND variant shows no ped.
local MENU = joaat('FE_MENU_VERSION_EMPTY')
-- Longest wait for the frontend to take control after it opens.
local READY_TIMEOUT_MS = 1000
-- Time a fresh clone needs to build its model and clothes. A ped given earlier shows nothing.
local CLONE_DELAY_MS = 200
-- The menu ped starts asleep: it is woken, then set awake again once the wake animation ran.
local WAKE_MS = 1000
-- HUD colours the menu paints its background with: HUD_COLOUR_FREEMODE (the blue tint) and HUD_COLOUR_PAUSE_BG.
-- Made transparent so the game stays visible behind the ped, and put back on close for the real pause menu.
local BACKGROUND_COLOURS = { 116, 117 }
-- Where the menu draws the ped: 0 left, 1 middle, 2 right.
local PED_COLUMN = 1
-- Longest wait for an animation dictionary.
local LOAD_TIMEOUT_MS = 1000
local UNARMED = joaat('WEAPON_UNARMED')

local Callback = UgInventory.Enums.NuiCallback

---@class UgInventoryPedAnimation
---@field dict string
---@field name string
---@field duration? integer ms a reaction plays before the idle comes back

-- The menu draws the copy as it moves: the copy stands in a loop, and reacts to what the player does.
-- Owner config previewAnimations: idle, and one reaction per page callback. A missing one plays nothing.
---@type UgInventoryPedAnimation?
local idle = nil
---@type table<UgInventoryNuiCallback, UgInventoryPedAnimation>
local reactions = {}
local REACTION_CALLBACKS = { Callback.Give, Callback.Buy, Callback.Drop }

---@type integer?
local clone = nil
local active = false
local enabled = true
---@type table<integer, integer[]>? the background colours before the preview changed them
local background = nil
-- Bumped by every Start and Stop, so a late thread never gives a ped to a menu that closed.
local generation = 0
---@type table<string, true> dictionaries loaded while open, released on close
local dictionaries = {}

---@param value boolean
function Preview.SetEnabled(value)
    enabled = value
end

---@param value? table<string, UgInventoryPedAnimation> owner config previewAnimations
function Preview.SetAnimations(value)
    value = type(value) == 'table' and value or {}
    idle = value.idle
    reactions = {}

    for _, callback in ipairs(REACTION_CALLBACKS) do
        reactions[callback] = value[callback]
    end
end

---@return boolean
function Preview.IsActive()
    return active
end

---Whether the frontend open now is this preview, and not the pause menu.
---@return boolean
function Preview.IsOwnMenu()
    return active and GetCurrentFrontendMenuVersion() == MENU
end

---@param dict string
---@return boolean loaded
local function loadDict(dict)
    if dictionaries[dict] then
        return true
    end

    RequestAnimDict(dict)

    local deadline = GetGameTimer() + LOAD_TIMEOUT_MS

    while not HasAnimDictLoaded(dict) do
        if GetGameTimer() >= deadline then
            return false
        end

        Wait(0)
    end

    dictionaries[dict] = true

    return true
end

---@param ped integer
---@param animation UgInventoryPedAnimation
---@param loop boolean
local function play(ped, animation, loop)
    -- Flag 1 loops, 0 plays once.
    TaskPlayAnim(ped, animation.dict, animation.name, 8.0, -8.0, -1, loop and 1 or 0, 0.0, false, false, false)
end

local function removeClone()
    if clone and DoesEntityExist(clone) then
        DeleteEntity(clone)
    end

    clone = nil
end

---Gives the copy the weapon the player holds, with its tint.
---@param ped integer the player ped
---@param copy integer
local function copyWeapon(ped, copy)
    local weapon = GetSelectedPedWeapon(ped)

    RemoveAllPedWeapons(copy, true)

    if weapon and weapon ~= UNARMED then
        GiveWeaponToPed(copy, weapon, 0, false, true)
        SetCurrentPedWeapon(copy, weapon, true)
        SetPedWeaponTintIndex(copy, weapon, GetPedWeaponTintIndex(ped, weapon))
    end
end

---Copies the player ped into the menu, once per open. Runs in a thread.
---@param run integer the generation it was asked in
local function giveClone(run)
    local deadline = GetGameTimer() + READY_TIMEOUT_MS

    while run == generation and not IsFrontendReadyForControl() and GetGameTimer() < deadline do
        Wait(0)
    end

    if run ~= generation then
        return
    end

    local ped = ClonePed(PlayerPedId(), false, false, true)

    -- Owned from here, so a refresh while it builds dresses this one, and Stop deletes it.
    clone = ped
    SetEntityVisible(ped, false, false)
    SetEntityCollision(ped, false, false)
    FreezeEntityPosition(ped, true)
    local loop = idle

    if loop then
        RequestAnimDict(loop.dict)
    end

    Wait(CLONE_DELAY_MS)

    if loop and run == generation and loadDict(loop.dict) then
        play(ped, loop, true)
    end

    if run ~= generation then
        return
    end

    GivePedToPauseMenu(ped, PED_COLUMN)
    SetPauseMenuPedLighting(true)
    -- The ped given to the menu starts asleep and vanishes unless woken.
    SetPauseMenuPedSleepState(false)
    Wait(WAKE_MS)

    if run == generation then
        SetPauseMenuPedSleepState(true)
    end
end

function Preview.Start()
    if active or not enabled then
        return
    end

    active = true
    generation = generation + 1

    local run = generation

    if not background then
        background = {}

        for _, colour in ipairs(BACKGROUND_COLOURS) do
            background[colour] = { GetHudColour(colour) }
        end
    end

    for _, colour in ipairs(BACKGROUND_COLOURS) do
        ReplaceHudColourWithRgba(colour, 0, 0, 0, 0)
    end
    SetFrontendActive(true)
    ActivateFrontendMenu(MENU, true, -1)
    -- The game cursor would show next to the page's own.
    SetMouseCursorVisible(false)

    CreateThread(function()
        giveClone(run)
    end)
end

---Plays what the copy does after a page action went through, then the idle again.
---@param callback UgInventoryNuiCallback
function Preview.React(callback)
    local reaction = reactions[callback]

    if not active or not clone or not reaction then
        return
    end

    local ped = clone

    CreateThread(function()
        if not loadDict(reaction.dict) or ped ~= clone then
            return
        end

        play(ped, reaction, false)
        Wait(reaction.duration or 1000)

        local loop = idle

        if ped == clone and loop and dictionaries[loop.dict] then
            play(ped, loop, true)
        elseif ped == clone then
            ClearPedTasks(ped)
        end
    end)
end

---Shows the ped again, after a weapon or a clothing piece changed.
function Preview.Refresh()
    if not active then
        return
    end

    -- The menu shows no second ped given to it, and restarting the menu flashes the HUD: the copy it shows is
    -- dressed again instead.
    if clone and DoesEntityExist(clone) then
        local ped = PlayerPedId()

        ClonePedToTarget(ped, clone)
        copyWeapon(ped, clone)
    end
end

function Preview.Stop()
    if not active then
        return
    end

    active = false
    generation = generation + 1
    ClearPedInPauseMenu()
    removeClone()
    SetFrontendActive(false)

    for dict in pairs(dictionaries) do
        RemoveAnimDict(dict)
    end

    dictionaries = {}

    if background then
        for _, colour in ipairs(BACKGROUND_COLOURS) do
            local rgba = background[colour]

            ReplaceHudColourWithRgba(colour, rgba[1], rgba[2], rgba[3], rgba[4])
        end

        background = nil
    end
end
