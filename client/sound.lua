--[[

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

]] --

-- Screen sounds, played by the game: the page has no GTA audio. Names are frontend sounds of the base game.

---@class UgInventory.Internal.Sound
local Sound = {}
UgInventory.Internal.Sound = Sound

local Enums = UgInventory.Enums
local Sounds = Enums.Sound
local Callback = Enums.NuiCallback

---@class UgInventorySoundEffect
---@field name string
---@field set string

-- Owner config soundEffects. A sound missing from it plays nothing.
---@type table<UgInventorySound, UgInventorySoundEffect>
local effects = {}

-- The sound of each page action that went through. A refused action plays Error.
---@type table<UgInventoryNuiCallback, UgInventorySound>
local RESULTS = {
    [Callback.Move] = Sounds.Move,
    [Callback.Use] = Sounds.Use,
    [Callback.Give] = Sounds.Give,
    [Callback.Drop] = Sounds.Drop,
    [Callback.Buy] = Sounds.Buy,
    [Callback.Attach] = Sounds.Attach,
    [Callback.Detach] = Sounds.Detach,
    [Callback.Reload] = Sounds.Reload,
    [Callback.Unload] = Sounds.Reload,
    [Callback.Clothing] = Sounds.Use,
}

local enabled = true

---@param value boolean
function Sound.SetEnabled(value)
    enabled = value
end

---@param value? table<UgInventorySound, UgInventorySoundEffect> owner config soundEffects
function Sound.SetEffects(value)
    effects = type(value) == 'table' and value or {}
end

---@return boolean
function Sound.IsEnabled()
    return enabled
end

---@param sound UgInventorySound
function Sound.Play(sound)
    local entry = effects[sound]

    if enabled and entry then
        PlaySoundFrontend(-1, entry.name, entry.set, true)
    end
end

---Plays what a page action ended with.
---@param callback UgInventoryNuiCallback
---@param ok boolean
function Sound.Result(callback, ok)
    if not ok then
        Sound.Play(Sounds.Error)
    elseif RESULTS[callback] then
        Sound.Play(RESULTS[callback])
    end
end
