--[[

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

]] --

-- The inventory screen: opens the page with the player inventory and, next to it, a container or a shop, and runs
-- what the page asks through ug-core. ug-core decides every action and every distance: the page only asks.

---@class UgInventory.Internal.Screen
local Screen = {}
UgInventory.Internal.Screen = Screen

local Nui = UgInventory.Internal.Nui
local State = UgInventory.Internal.State
local Preview = UgInventory.Internal.Preview
local Sound = UgInventory.Internal.Sound
local Wardrobe = UgInventory.Internal.Wardrobe
local Enums = UgInventory.Enums
local Action = Enums.NuiAction
local Callback = Enums.NuiCallback
local Side = Enums.Side
local Kind = Enums.Kind
local Errors = UgCore.Enums.Errors

-- Rear door index of GTA vehicles, opened while the trunk is open.
local TRUNK_DOOR = 5
local WATCH_MS = 250
-- Time for a weapon change to show on the ped before the preview copies it again.
local REFRESH_MS = 300

---@class UgInventoryTarget
---@field kind UgInventoryKind
---@field key string|integer stash name, drop id, shop name, or vehicle entity
---@field label? string

local open = false
local busy = false
---@type UgInventoryTarget?
local other = nil
local radarHidden = false
local giveDistance = 3.0
-- Owner config features. Off hides them on the page and refuses them here.
local features = {
    giving = true,
    dropping = true,
    workbench = true,
}

---@return boolean
function Screen.IsOpen()
    return open
end

---@return boolean
local function canAct()
    local LocalPlayer = UgCore.LocalPlayer

    return not (LocalPlayer and (LocalPlayer.IsDead() or LocalPlayer.IsDowned()))
end

---Players close enough to give items to, by server id, with their name when ug-core published it.
---@return { id: integer, name: string }[]
function Screen.NearbyPlayers()
    local own = PlayerId()
    local coords = GetEntityCoords(PlayerPedId())
    local key = UgCore.Enums.StateBags.Player
    local list = {}

    for _, player in ipairs(GetActivePlayers()) do
        if player ~= own then
            local ped = GetPlayerPed(player)
            local position = GetEntityCoords(ped)

            if #(position - coords) <= giveDistance then
                local id = GetPlayerServerId(player)
                local state = Player(id).state[key]

                list[#list + 1] = {
                    id = id,
                    name = type(state) == 'table' and type(state.name) == 'string' and state.name or ('#' .. id),
                }
            end
        end
    end

    table.sort(list, function(a, b)
        return a.id < b.id
    end)

    return list
end

---The shop as the page shows it: what it sells, and what the player has to pay with.
---@param name string
---@return table? shop
---@return UgErrorCode? errorCode
local function describeShop(name)
    local ok, errorCode, listing = UgCore.Shops.Open(name)

    if not ok or not listing then
        return nil, errorCode
    end

    return {
        kind = Kind.Shop,
        label = listing.label,
        account = listing.account,
        balance = UgCore.Modules.IsEnabled('accounts') and UgCore.Accounts.GetBalance(listing.account) or nil,
        listing = listing.items,
    }, nil
end

---Opens the container or shop of a target. Runs in a thread.
---@param target UgInventoryTarget
---@return table? payload
local function openOther(target)
    if target.kind == Kind.Shop then
        return (describeShop(target.key --[[@as string]]))
    end

    -- Every kind but shop is a container kind of ug-core.
    if not UgCore.Inventory.Open(target.kind --[[@as 'stash'|'trunk'|'glovebox'|'drop']], target.key) then
        return nil
    end

    local opened = UgCore.Inventory.GetOther()

    if not opened then
        return nil
    end

    return {
        kind = target.kind,
        label = opened.label or target.label,
        slots = opened.slots,
        maxWeight = opened.maxWeight,
        items = opened.items,
    }
end

---Closes what the server already closed: out of reach, or removed.
local function forgetOther()
    if other and other.kind == Kind.Trunk and DoesEntityExist(other.key --[[@as integer]]) then
        SetVehicleDoorShut(other.key --[[@as integer]], TRUNK_DOOR, false)
    end

    other = nil
end

---Closes the screen when the player can no longer use it.
local function watch()
    CreateThread(function()
        while open do
            Wait(WATCH_MS)

            -- The preview is a frontend menu too: only the real pause menu closes the screen.
            if open and (not canAct() or (IsPauseMenuActive() and not Preview.IsOwnMenu())) then
                Screen.Close()
            end
        end
    end)
end

---Opens the inventory, with a container or shop next to it when a target is given.
---@param target? UgInventoryTarget
function Screen.Open(target)
    if open or busy or not UgCore.Inventory.IsLoaded() or not canAct() then
        return
    end

    busy = true

    CreateThread(function()
        local payload = target and openOther(target) or nil

        busy = false
        Screen.Show(payload and target or nil, payload)
    end)
end

---Shows the screen with what is open next to the pockets. With the screen already open, only that side changes.
---@param target? UgInventoryTarget
---@param payload? table the other side as the page reads it
function Screen.Show(target, payload)
    if open then
        if other and other ~= target then
            forgetOther()
        end

        other = payload and target or nil
        Nui.Send(Action.Other, payload)

        return
    end

    if not canAct() then
        return
    end

    other = payload and target or nil
    open = true

    if other and other.kind == Kind.Trunk then
        SetVehicleDoorOpen(other.key --[[@as integer]], TRUNK_DOOR, false, false)
    end

    Nui.Send(Action.Open, {
        player = State.Player(),
        other = payload,
        definitions = State.Definitions(),
        equipped = State.GetEquipped(),
        nearby = features.giving and Screen.NearbyPlayers() or {},
        weapons = UgCore.Modules.IsEnabled('weapons'),
        clothing = Wardrobe.State(),
    })

    SetNuiFocus(true, true)
    radarHidden = IsRadarHidden()
    DisplayRadar(false)
    Preview.Start()
    Sound.Play(Enums.Sound.Open)
    watch()
    UgCore.Events.Emit(Enums.Events.Opened, other and other.kind or nil)
end

function Screen.Close()
    if not open then
        return
    end

    open = false
    SetNuiFocus(false, false)
    Nui.Send(Action.Close)
    Preview.Stop()
    Sound.Play(Enums.Sound.Close)
    DisplayRadar(not radarHidden)

    local closing = other

    forgetOther()

    if closing and closing.kind ~= Kind.Shop then
        CreateThread(function()
            UgCore.Inventory.Close()
        end)
    end

    UgCore.Events.Emit(Enums.Events.Closed)
end

---Answers a page request.
---@param id integer
---@param ok boolean
---@param errorCode? UgErrorCode
---@param extra? table fields added to the answer
local function reply(id, ok, errorCode, extra)
    local payload = extra or {}

    payload.id, payload.ok = id, ok == true
    payload.error = not ok and (errorCode or Errors.InternalError) or nil
    Nui.Send(Action.Result, payload)
end

---Runs a page request in a thread, when the screen is open.
---@param callback UgInventoryNuiCallback
---@param handler fun(value: table): boolean, UgErrorCode?, table?
local function handle(callback, handler)
    Nui.On(callback, function(value)
        if not open then
            return
        end

        CreateThread(function()
            local ok, errorCode, extra = handler(value)

            reply(value.id, ok, errorCode, extra)
            Sound.Result(callback, ok == true)

            if ok and open then
                Preview.React(callback)
            end
        end)
    end)
end

---@return boolean
local function hasContainer()
    return other ~= nil and other.kind ~= Kind.Shop
end

handle(Callback.Move, function(value)
    local touchesOther = value.from == Side.Other or value.to == Side.Other

    if touchesOther and not hasContainer() then
        return false, Errors.NoPermission
    end

    return UgCore.Inventory.MoveBetween(value.from, value.fromSlot, value.to, value.toSlot, value.count)
end)

handle(Callback.Use, function(value)
    State.ExpectEquip(value.slot)

    return UgCore.Inventory.Use(value.slot)
end)

handle(Callback.Give, function(value)
    if not features.giving then
        return false, Errors.NoPermission
    end

    return UgCore.Inventory.Give(value.target, value.slot, value.count)
end)

handle(Callback.Drop, function(value)
    if not features.dropping then
        return false, Errors.NoPermission
    end

    return UgCore.Inventory.Drop(value.slot, value.count)
end)

handle(Callback.Clothing, function(value)
    return Wardrobe.Toggle(value.piece)
end)

handle(Callback.Buy, function(value)
    if not other or other.kind ~= Kind.Shop then
        return false, Errors.NoPermission
    end

    local name = other.key --[[@as string]]
    local ok, errorCode = UgCore.Shops.Buy(name, value.index, value.count)

    -- Stock and balance changed: the page gets the shop again either way.
    local shop = describeShop(name)

    if shop and open then
        Nui.Send(Action.Other, shop)
    end

    return ok, errorCode
end)

---@param run fun(value: table): boolean, UgErrorCode?
---@param bench? boolean an action of the workbench, refused when the owner turned it off
---@return fun(value: table): boolean, UgErrorCode?
local function weapon(run, bench)
    return function(value)
        if not UgCore.Modules.IsEnabled('weapons') then
            return false, Errors.NotFound
        end

        if bench and not features.workbench then
            return false, Errors.NoPermission
        end

        return run(value)
    end
end

handle(Callback.Attach, weapon(function(value)
    return UgCore.Weapons.Attach(value.weaponSlot, value.itemSlot)
end, true))

handle(Callback.Detach, weapon(function(value)
    return UgCore.Weapons.Detach(value.slot, value.item)
end, true))

handle(Callback.Reload, weapon(function()
    return UgCore.Weapons.Reload()
end))

handle(Callback.Unload, weapon(function()
    return UgCore.Weapons.Unload()
end))

Nui.On(Callback.Close, Screen.Close)

Nui.On(Callback.Sound, function(value)
    if open then
        Sound.Play(value.sound)
    end
end)

---Starts listening to ug-core. Called once ug-core is ready.
---@param settings table the replicated config
function Screen.Start(settings)
    giveDistance = settings.giveDistance or giveDistance
    features.giving = settings.giving ~= false
    features.dropping = settings.dropping ~= false
    features.workbench = settings.workbench ~= false
    Preview.SetEnabled(settings.pedPreview ~= false)
    Sound.SetEnabled(settings.sounds ~= false)
    Sound.SetEffects(settings.soundEffects)
    Preview.SetAnimations(settings.previewAnimations)

    if UgCore.Modules.IsEnabled('weapons') then
        local WeaponEvents = UgCore.Enums.Events.Weapons

        for _, event in ipairs({ WeaponEvents.Equipped, WeaponEvents.Unequipped }) do
            UgCore.Events.On(event, function()
                SetTimeout(REFRESH_MS, Preview.Refresh)
            end)
        end
    end

    UgCore.Events.On(UgCore.Enums.Events.Inventory.Closed, function()
        if other and other.kind ~= Kind.Shop then
            forgetOther()
        end
    end)

    -- Server code opened an inventory for this player: an admin, a search, a house stash. Opens of the open key
    -- arrive while it waits, and it shows those itself.
    UgCore.Events.On(UgCore.Enums.Events.Inventory.Opened, function(opened)
        if busy or type(opened) ~= 'table' or not UgCore.Inventory.IsLoaded() then
            return
        end

        Screen.Show({
            kind = Kind.Inventory,
            key = '',
            label = opened.label,
        }, {
            kind = Kind.Inventory,
            label = opened.label,
            slots = opened.slots,
            maxWeight = opened.maxWeight,
            items = opened.items,
        })
    end)
end

AddEventHandler('onResourceStop', function(resource)
    if resource == GetCurrentResourceName() and open then
        SetNuiFocus(false, false)
        Preview.Stop()
        DisplayRadar(not radarHidden)
    end
end)
