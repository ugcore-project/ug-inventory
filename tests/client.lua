--[[

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

]] --

local H = dofile('tests/helpers.lua')

---@param name string
---@return table
local function keybind(name)
    for _, options in ipairs(H.Keybinds) do
        if options.name == name then
            return options
        end
    end

    error('no keybind ' .. name)
end

---@return boolean
local function focused()
    local calls = H.CallsOf('SetNuiFocus')

    return #calls > 0 and calls[#calls].args[1] == true
end

---Posts a page action and returns the result message Lua answered with.
---@param callback string
---@param body table
---@return table? result
---@return any reply
local function post(callback, body)
    local reply = H.PostNui(callback, body)

    return H.LastPage('result') or nil, reply
end

local function press(name)
    keybind(name).onPressed()
end

---@param list { name: string, args: any[] }[]
---@param name string
---@return any[][]
local function emitted(list, name)
    local found = {}

    for _, entry in ipairs(list) do
        if entry.name == name then
            found[#found + 1] = entry.args
        end
    end

    return found
end

print('client')

H.Test('boot registers the open key, the hotbar keys and the wheel', function()
    H.Reset()

    local lines = H.LoadClient()

    H.ExpectLine(lines, '[ug-inventory] Ready: hotbar 5, wheel 8.')
    H.Equal(keybind('open').defaultKey, 'TAB')
    H.Equal(keybind('slot5').defaultKey, '5')
    H.Equal(keybind('wheel').defaultKey, 'Z')

    local config = H.LastPage('config')

    H.Equal({ config.hotbar, config.wheel, config.toasts, config.openKey }, { 5, 8, true, 'TAB' })
    H.Equal(config.labels.pockets, 'Pockets')
end)

H.Test('waits for the server config and needs the inventory modules', function()
    H.Reset()
    H.Load('client')
    H.Advance(60000)

    H.Equal(#H.Keybinds, 0)

    H.Reset()
    H.Modules.inventory = nil

    H.ExpectLine(H.LoadClient(), 'needs the items and inventory modules')
    H.Equal(#H.Keybinds, 0)
end)

H.Test('the open key opens the pockets alone, with the character preview, and closes again', function()
    H.Reset()
    H.LoadClient()
    GlobalState['ug-inventory:Categories'] = {
        weapon_pistol = 'weapon',
    }
    press('open')

    local opened = H.LastPage('open')

    H.Equal(opened.player, {
        slots = 10,
        maxWeight = 30000,
        items = {
            {
                slot = 1,
                name = 'water',
                count = 3,
            },
        },
    })
    H.Equal(opened.other, nil)
    H.Equal(opened.definitions.water.maxStack, 10)
    H.Equal(opened.definitions.water.category, 'consumable')
    H.Equal(opened.definitions.weapon_pistol.category, 'weapon')
    H.Equal(opened.weapons, true)
    H.Assert(focused(), 'focus')
    H.Equal(H.CallsOf('ActivateFrontendMenu')[1].args[1], joaat('FE_MENU_VERSION_EMPTY'))
    H.Equal(#H.CallsOf('GivePedToPauseMenu'), 0, 'not before the clone is built')
    H.Advance(500)
    H.Equal(H.CallsOf('GivePedToPauseMenu')[1].args, { 300, 1 }, 'a copy of the ped is shown, in the middle')
    H.Advance(1000)
    H.Equal(H.CallsOf('SetPauseMenuPedSleepState')[1].args, { false }, 'the ped wakes up')
    H.Equal(H.CallsOf('SetPauseMenuPedSleepState')[2].args, { true })
    H.Equal(#H.RequestsOf('Inventory.Open'), 0)
    H.Equal(emitted(H.Emitted, 'ug-inventory:Opened'), { {} })
    H.Equal(H.Exports.IsOpen(), true)

    press('open')

    H.Assert(not focused(), 'focus dropped')
    H.Equal(H.LastPage('close'), false)
    H.Equal(H.CallsOf('DeleteEntity')[1].args, { 300 }, 'the copy is deleted')
    H.Equal(H.CallsOf('SetFrontendActive')[2].args, { false })
    H.Equal(H.CallsOf('ReplaceHudColourWithRgba')[1].args, { 116, 0, 0, 0, 0 }, 'no blue tint while open')
    H.Equal(H.CallsOf('ReplaceHudColourWithRgba')[4].args, {
        117,
        10,
        20,
        30,
        200,
    }, 'the pause menu gets its background back')
    H.Equal(#H.RequestsOf('Inventory.Close'), 0, 'nothing was open next to the pockets')
    H.Equal(#emitted(H.Emitted, 'ug-inventory:Closed'), 1)
end)

H.Test('in a vehicle the open key opens its glovebox', function()
    H.Reset()
    H.LoadClient()
    H.NativeReturns.GetVehiclePedIsIn = 55
    H.NativeReturns.IsPedInAnyVehicle = true
    H.Other = {
        label = 'Glovebox',
        slots = 5,
        maxWeight = 10000,
        items = {},
    }
    press('open')

    H.Equal(H.RequestsOf('Inventory.Open'), { { 'glovebox', 55 } })
    H.Equal(H.LastPage('open').other, {
        kind = 'glovebox',
        label = 'Glovebox',
        slots = 5,
        maxWeight = 10000,
        items = {},
    })

    press('open')

    H.Equal(#H.RequestsOf('Inventory.Close'), 1)
end)

H.Test('the open key picks the closest drop, stash, trunk or shop in reach', function()
    H.Reset()
    H.LoadClient()
    GlobalState['ug-inventory:Stashes'] = {
        {
            name = 'motel',
            label = 'Motel',
            coords = vector3(1.5, 0.0, 0.0),
        },
    }
    H.Drops = {
        far = vector3(10.0, 0.0, 0.0),
        near = vector3(1.0, 0.0, 0.0),
    }
    H.Shops = {
        shop = {
            label = '24/7',
            coords = { vector3(0.5, 0.0, 0.0) },
        },
    }

    H.Equal(UgInventory.Internal.Open.FindTarget(), {
        kind = 'shop',
        key = 'shop',
        label = '24/7',
    })

    H.Modules.shops = nil
    H.Equal(UgInventory.Internal.Open.FindTarget(), {
        kind = 'drop',
        key = 'near',
    })

    H.Drops = {}
    H.Equal(UgInventory.Internal.Open.FindTarget(), {
        kind = 'stash',
        key = 'motel',
        label = 'Motel',
    })

    H.NativeReturns.GetGamePool = { 70 }
    H.NativeReturns.GetEntityCoords = function(entity)
        return entity == 70 and vector3(3.0, 0.0, 0.0) or vector3(0.0, 0.0, 0.0)
    end
    H.NativeReturns.GetModelDimensions = vector3(-1.0, -2.0, -0.5)
    H.NativeReturns.GetOffsetFromEntityInWorldCoords = vector3(1.0, 0.0, 0.0)

    H.Equal(UgInventory.Internal.Open.FindTarget(), {
        kind = 'trunk',
        key = 70,
    }, 'the trunk is closer than the stash')

    H.NativeReturns.GetVehicleDoorLockStatus = 2
    H.Equal(UgInventory.Internal.Open.FindTarget().kind, 'stash', 'a locked trunk is skipped')

    GlobalState['ug-inventory:Stashes'] = {}
    H.Equal(UgInventory.Internal.Open.FindTarget(), nil)
end)

H.Test('a container ug-core refuses leaves the pockets alone', function()
    H.Reset()
    H.LoadClient()
    H.Answers['Inventory.Open'] = { false, 'no_permission' }
    UgInventory.Internal.Screen.Open({
        kind = 'stash',
        key = 'police',
    })

    H.Equal(H.LastPage('open').other, nil)
end)

H.Test('nobody opens it dead or downed, and dying closes it', function()
    H.Reset()
    H.LoadClient()
    H.Downed = true
    press('open')

    H.Equal(H.LastPage('open'), nil)

    H.Downed = false
    press('open')
    H.Dead = true
    H.Advance(300)

    H.Assert(not focused(), 'closed on death')
    H.Equal(H.Exports.IsOpen(), false)
end)

H.Test('page moves go to ug-core and get an answer of the same id', function()
    H.Reset()
    H.LoadClient()
    H.Other = {
        slots = 5,
        maxWeight = 10000,
        items = {},
    }
    H.Exports.OpenStash('motel')

    local result = post('move', {
        id = 4,
        from = 'player',
        fromSlot = 1,
        to = 'other',
        toSlot = 2,
        count = 2,
    })

    H.Equal(H.RequestsOf('Inventory.MoveBetween'), { { 'player', 1, 'other', 2, 2 } })
    H.Equal(result, {
        id = 4,
        ok = true,
    })

    H.Answers['Inventory.MoveBetween'] = { false, 'cannot_carry' }
    H.Equal(post('move', {
        id = 5,
        from = 'other',
        fromSlot = 1,
        to = 'player',
        toSlot = 2,
    }), {
        id = 5,
        ok = false,
        error = 'cannot_carry',
    })
end)

H.Test('moves to the other side need a container, and shops are not one', function()
    H.Reset()
    H.LoadClient()
    press('open')

    H.Equal(post('move', {
        id = 1,
        from = 'player',
        fromSlot = 1,
        to = 'other',
        toSlot = 1,
    }), {
        id = 1,
        ok = false,
        error = 'no_permission',
    })
    H.Equal(#H.RequestsOf('Inventory.MoveBetween'), 0)
end)

H.Test('broken bodies are refused before ug-core, and the page has a budget', function()
    H.Reset()
    H.LoadClient()
    press('open')

    local _, reply = post('move', {
        id = 1,
        from = 'player',
        fromSlot = 0,
        to = 'player',
        toSlot = 1,
    })

    H.Equal(reply, {
        ok = false,
    })
    H.Equal(select(2, post('give', {
        id = 1,
        slot = 1,
        target = H.Any('7'),
    })), {
        ok = false,
    })
    H.Equal(select(2, post('detach', {
        id = 1,
        slot = 1,
        item = 'Bad Name',
    })), {
        ok = false,
    })
    H.Equal(select(2, post('use', {
        id = 1,
        slot = 1,
        extra = true,
    })), {
        ok = false,
    })
    H.Equal(#H.Requests, 0)

    H.Advance(1000)

    local accepted = 0

    for index = 1, 60 do
        if H.PostNui('wheelPick', {
            slot = 0,
        }).ok then
            accepted = accepted + 1
        end
    end

    H.Equal(accepted, 40)
end)

H.Test('use, give and drop pass through with their counts', function()
    H.Reset()
    H.LoadClient()
    press('open')
    post('use', {
        id = 1,
        slot = 1,
    })
    post('give', {
        id = 2,
        slot = 1,
        count = 2,
        target = 7,
    })
    post('drop', {
        id = 3,
        slot = 1,
        count = 1,
    })

    H.Equal(H.RequestsOf('Inventory.Use'), { { 1 } })
    H.Equal(H.RequestsOf('Inventory.Give'), { { 7, 1, 2 } })
    H.Equal(H.RequestsOf('Inventory.Drop'), { { 1, 1 } })
end)

H.Test('a shop opens with the balance, buys, and sends the shop again', function()
    H.Reset()
    H.LoadClient()
    H.Balance = 300
    H.Listings.market = {
        label = '24/7',
        account = 'cash',
        items = {
            {
                index = 1,
                name = 'water',
                price = 5,
                stock = 10,
            },
        },
    }
    H.Exports.OpenShop('market')

    H.Equal(H.LastPage('open').other, {
        kind = 'shop',
        label = '24/7',
        account = 'cash',
        balance = 300,
        listing = {
            {
                index = 1,
                name = 'water',
                price = 5,
                stock = 10,
            },
        },
    })
    H.Equal(#H.RequestsOf('Inventory.Open'), 0)

    H.Balance = 290
    post('buy', {
        id = 9,
        index = 1,
        count = 2,
    })

    H.Equal(H.RequestsOf('Shops.Buy'), { { 'market', 1, 2 } })
    H.Equal(H.LastPage('other').balance, 290)
    H.Equal(H.LastPage('result'), {
        id = 9,
        ok = true,
    })

    press('open')

    H.Equal(#H.RequestsOf('Inventory.Close'), 0, 'shops are not containers')
end)

H.Test('weapon actions need the weapons module', function()
    H.Reset()
    H.LoadClient()
    press('open')
    post('attach', {
        id = 1,
        weaponSlot = 1,
        itemSlot = 2,
    })
    post('reload', {
        id = 2,
    })

    H.Equal(H.RequestsOf('Weapons.Attach'), { { 1, 2 } })
    H.Equal(#H.RequestsOf('Weapons.Reload'), 1)

    H.Modules.weapons = nil

    H.Equal(post('unload', {
        id = 3,
    }), {
        id = 3,
        ok = false,
        error = 'not_found',
    })
    H.Equal(#H.RequestsOf('Weapons.Unload'), 0)
end)

H.Test('changes reach the page, and counts that changed become toasts', function()
    H.Reset()
    H.LoadClient()

    local Changed = UgCore.Enums.Events.Inventory.Changed

    H.Inventory.items[1].count = 5
    H.Inventory.items[2] = {
        name = 'weapon_pistol',
        count = 1,
    }
    H.Fire(Changed, {
        {
            slot = 1,
            item = {
                name = 'water',
                count = 5,
            },
        },
        {
            slot = 2,
            item = {
                name = 'weapon_pistol',
                count = 1,
            },
        },
    }, 'player')

    H.Equal(H.LastPage('update').changes[2].slot, 2)
    H.Equal(H.LastPage('toast'), {
        {
            name = 'water',
            label = 'Water',
            delta = 2,
        },
        {
            name = 'weapon_pistol',
            label = 'Pistol',
            delta = 1,
        },
    })

    local toasts = #H.CallsOf('SendNUIMessage')

    H.Inventory.items = {}
    H.Fire(Changed, nil, 'player')

    H.Equal(H.LastPage('update').inventory.items, {})
    H.Equal(H.LastPage('update').side, 'player')
    H.Equal(#H.CallsOf('SendNUIMessage'), toasts + 1, 'a full sync shows no toast')

    H.Fire(Changed, {
        {
            slot = 3,
        },
    }, 'other')

    H.Equal(H.LastPage('update'), {
        side = 'other',
        changes = {
            {
                slot = 3,
            },
        },
    })
end)

H.Test('owners MAY turn toasts off', function()
    H.Reset()
    H.LoadClient({
        toasts = false,
    })
    H.Inventory.items[1].count = 1
    H.Fire(UgCore.Enums.Events.Inventory.Changed, {
        {
            slot = 1,
            item = {
                name = 'water',
                count = 1,
            },
        },
    }, 'player')

    H.Equal(H.LastPage('toast'), nil)
end)

H.Test('the weapon a use equips is marked by its serial', function()
    H.Reset()
    H.Inventory.items[2] = {
        name = 'weapon_pistol',
        count = 1,
        metadata = {
            serial = 'UG-1',
            ammo = 0,
        },
    }
    H.LoadClient()
    press('slot2')
    H.Fire(UgCore.Enums.Events.Weapons.Equipped)

    H.Equal(H.LastPage('equipped'), {
        serial = 'UG-1',
        armed = true,
    })
    H.Equal(UgInventory.Internal.State.GetEquipped(), 'UG-1')

    H.Fire(UgCore.Enums.Events.Weapons.Unequipped)

    H.Equal(H.LastPage('equipped'), {
        armed = false,
    })
end)

H.Test('slot keys use the slot and show the hotbar, but not while the screen is open', function()
    H.Reset()
    H.LoadClient()
    press('slot1')

    H.Equal(H.RequestsOf('Inventory.Use'), { { 1 } })
    H.Equal(H.LastPage('hotbar').active, 1)

    press('slot2')
    H.Equal(#H.RequestsOf('Inventory.Use'), 1, 'slot 2 is empty')

    press('open')
    press('slot1')
    H.Equal(#H.RequestsOf('Inventory.Use'), 1)
end)

H.Test('the wheel uses the picked slot, and closes on its own when the page is silent', function()
    H.Reset()
    H.LoadClient()
    press('wheel')

    H.Equal(H.LastPage('wheel').slots, 8)
    H.Equal(H.LastPage('wheel').items[1].label, 'Water', 'labels for a page without definitions')
    H.Assert(focused(), 'focus for the mouse')
    H.Equal(H.CallsOf('SetNuiFocusKeepInput')[1].args[1], true)

    H.PostNui('wheelPick', {
        slot = 1,
    })

    H.Equal(H.RequestsOf('Inventory.Use'), { { 1 } })
    H.Assert(not focused(), 'focus dropped')

    press('wheel')
    keybind('wheel').onReleased()

    H.Equal(H.LastPage('wheelClose'), false)
    H.Assert(focused(), 'waits for the page')

    H.Advance(450)

    H.Assert(not focused(), 'closed after the timeout')
    H.Equal(#H.RequestsOf('Inventory.Use'), 1)
end)

H.Test('the GTA weapon wheel stays hidden unless the owner wants it', function()
    H.Reset()
    H.LoadClient()
    H.Advance(20)

    H.Assert(#H.CallsOf('HideHudComponentThisFrame') > 0, 'hidden')

    H.Reset()
    H.LoadClient({
        disableWeaponWheel = false,
    })
    H.Advance(20)

    H.Equal(#H.CallsOf('HideHudComponentThisFrame'), 0)
end)

H.Test('exports check what they are given', function()
    H.Reset()
    H.LoadClient()
    H.Exports.OpenStash(H.Any(5))
    H.Exports.OpenTrunk(H.Any('car'))

    H.Equal(H.LastPage('open'), nil)

    H.NativeReturns.DoesEntityExist = true
    H.NativeReturns.GetEntityType = 2
    H.Other = {
        slots = 20,
        maxWeight = 50000,
        items = {},
    }
    H.Exports.OpenTrunk(70)

    H.Equal(H.RequestsOf('Inventory.Open'), { { 'trunk', 70 } })
    H.Equal(H.CallsOf('SetVehicleDoorOpen')[1].args[1], 70, 'the trunk door opens')
end)

H.Test('the preview menu keeps the screen open, the pause menu closes it', function()
    H.Reset()
    H.LoadClient()
    press('open')
    H.NativeReturns.IsPauseMenuActive = true
    H.NativeReturns.GetCurrentFrontendMenuVersion = joaat('FE_MENU_VERSION_EMPTY')
    H.Advance(500)

    H.Equal(H.Exports.IsOpen(), true)

    H.NativeReturns.GetCurrentFrontendMenuVersion = joaat('FE_MENU_VERSION_SP_PAUSE')
    H.Advance(500)

    H.Equal(H.Exports.IsOpen(), false)
end)

H.Test('the preview copies the ped again after a weapon change, and only while open', function()
    H.Reset()
    H.LoadClient()
    H.Fire(UgCore.Enums.Events.Weapons.Equipped)
    H.Advance(500)

    H.Equal(#H.CallsOf('ClonePed'), 0, 'closed: nothing to show')

    press('open')
    H.Advance(500)
    H.Fire(UgCore.Enums.Events.Weapons.Unequipped)
    H.Advance(1000)

    H.Equal(#H.CallsOf('ClonePed'), 1, 'the menu shows no second ped: the copy it has is dressed again')
    H.Equal(#H.CallsOf('GivePedToPauseMenu'), 1)
    H.Equal(#H.CallsOf('ActivateFrontendMenu'), 1, 'the menu stays open, so the HUD stays hidden')
    H.Equal(#H.CallsOf('DeleteEntity'), 0)
    H.Equal(H.CallsOf('ClonePedToTarget')[1].args[2], 300)
    H.Equal(#H.CallsOf('RemoveAllPedWeapons'), 1, 'the copy holds what the player holds')

    H.Advance(1000)

    local sleep = H.CallsOf('SetPauseMenuPedSleepState')

    H.Equal(#sleep, 2)
    H.Equal(sleep[#sleep].args, { true }, 'the copy stays awake')

    press('open')
    H.Fire(UgCore.Enums.Events.Weapons.Equipped)
    H.Advance(500)

    H.Equal(#H.CallsOf('ClonePedToTarget'), 1, 'closed: nothing to dress')
end)

H.Test('without pedPreview the screen opens no frontend menu', function()
    H.Reset()
    H.LoadClient({
        pedPreview = false,
    })
    press('open')
    H.Advance(200)

    H.Equal(H.Exports.IsOpen(), true)
    H.Equal(#H.CallsOf('ActivateFrontendMenu'), 0)
end)

---Names of the frontend sounds played, in order.
---@return string[]
local function sounds()
    local names = {}

    for _, call in ipairs(H.CallsOf('PlaySoundFrontend')) do
        names[#names + 1] = call.args[2]
    end

    return names
end

---Animations the preview copy played, as `dict/name`.
---@return string[]
local function animations()
    local names = {}

    for _, call in ipairs(H.CallsOf('TaskPlayAnim')) do
        names[#names + 1] = call.args[2] .. '/' .. call.args[3]
    end

    return names
end

H.Test('the preview copy idles, reacts to gives and drops, and its dictionaries are released', function()
    H.Reset()
    H.LoadClient()
    press('open')
    H.Advance(500)

    local idle = 'anim@heists@heist_corona@single_team/single_team_loop_boss'

    H.Equal(animations(), { idle })
    H.Equal(H.CallsOf('TaskPlayAnim')[1].args[1], 300, 'on the copy, never on the player')
    H.Equal(H.CallsOf('TaskPlayAnim')[1].args[7], 1, 'looped')

    post('give', {
        id = 1,
        slot = 1,
        count = 1,
        target = 7,
    })
    H.Advance(100)
    H.Equal(animations(), { idle, 'mp_common/givetake1_a' })
    H.Advance(2000)
    H.Equal(animations()[3], idle, 'back to the idle')

    H.Answers['Inventory.Drop'] = { false, 'cannot_carry' }
    post('drop', {
        id = 2,
        slot = 1,
        count = 1,
    })
    H.Advance(100)
    H.Equal(#animations(), 3, 'a refused action plays nothing')

    press('open')

    H.Equal(#H.CallsOf('RemoveAnimDict'), 2)
end)

H.Test('the screen plays game sounds for opening, results and what the page asks', function()
    H.Reset()
    H.LoadClient()
    press('open')
    post('give', {
        id = 1,
        slot = 1,
        count = 1,
        target = 7,
    })
    H.Answers['Inventory.Drop'] = { false, 'cannot_carry' }
    post('drop', {
        id = 2,
        slot = 1,
        count = 1,
    })
    H.Advance(100)

    H.Equal(sounds(), { 'SELECT', 'CONTINUE', 'ERROR' })

    H.Equal(H.PostNui('sound', {
        sound = 'hover',
    }), {
        ok = true,
    })
    H.Equal(H.PostNui('sound', {
        sound = 'error',
    }), {
        ok = false,
    }, 'the page asks for hover, pick and menu only')
    H.Equal(sounds()[4], 'NAV_UP_DOWN')

    H.Advance(1000)

    local accepted = 0

    for _ = 1, 30 do
        if H.PostNui('sound', {
            sound = 'pick',
        }).ok then
            accepted = accepted + 1
        end
    end

    H.Equal(accepted, 12)
    H.Equal(H.PostNui('wheelPick', {
        slot = 0,
    }), {
        ok = true,
    }, 'sounds never use the action budget')

    press('open')

    H.Equal(sounds()[#sounds()], 'BACK')
end)

H.Test('owners MAY turn sounds off', function()
    H.Reset()
    H.LoadClient({
        sounds = false,
    })
    press('open')
    H.PostNui('sound', {
        sound = 'hover',
    })
    post('give', {
        id = 1,
        slot = 1,
        count = 1,
        target = 7,
    })
    H.Advance(100)

    H.Equal(#H.CallsOf('PlaySoundFrontend'), 0)
    H.Equal(H.LastPage('config').sounds, false)
end)

H.Test('owners pick each sound, and a sound they leave out plays nothing', function()
    H.Reset()
    H.LoadClient({
        soundEffects = {
            open = {
                name = 'TOGGLE_ON',
                set = 'HUD_FRONTEND_DEFAULT_SOUNDSET',
            },
        },
    })
    press('open')
    post('give', {
        id = 1,
        slot = 1,
        count = 1,
        target = 7,
    })
    H.Advance(100)

    H.Equal(sounds(), { 'TOGGLE_ON' })
    H.Equal(H.CallsOf('PlaySoundFrontend')[1].args[3], 'HUD_FRONTEND_DEFAULT_SOUNDSET')
end)

H.Test('owners pick the preview animations, and an idle left out stands still', function()
    H.Reset()
    H.LoadClient({
        previewAnimations = {
            give = {
                dict = 'my@dict',
                name = 'wave',
                duration = 500,
            },
        },
    })
    press('open')
    H.Advance(500)

    H.Equal(animations(), {}, 'no idle')

    post('give', {
        id = 1,
        slot = 1,
        count = 1,
        target = 7,
    })
    H.Advance(100)
    H.Equal(animations(), { 'my@dict/wave' })

    post('drop', {
        id = 2,
        slot = 1,
        count = 1,
    })
    H.Advance(1000)
    H.Equal(animations(), { 'my@dict/wave' }, 'no drop reaction')
    H.Equal(#H.CallsOf('ClearPedTasks'), 1, 'the copy stops after the reaction')
end)

H.Test('owners MAY turn giving, dropping and the workbench off, and the screen refuses them', function()
    H.Reset()
    H.LoadClient({
        giving = false,
        dropping = false,
        workbench = false,
    })
    press('open')

    H.Equal(H.LastPage('open').nearby, {}, 'nobody to give to')

    H.Equal(post('give', {
        id = 1,
        slot = 1,
        count = 1,
        target = 7,
    }), {
        id = 1,
        ok = false,
        error = 'no_permission',
    })
    H.Equal(post('drop', {
        id = 2,
        slot = 1,
        count = 1,
    }), {
        id = 2,
        ok = false,
        error = 'no_permission',
    })
    H.Equal(post('attach', {
        id = 3,
        weaponSlot = 1,
        itemSlot = 2,
    }), {
        id = 3,
        ok = false,
        error = 'no_permission',
    })
    H.Equal(post('reload', {
        id = 4,
    }), {
        id = 4,
        ok = true,
    }, 'reloading is not the workbench')

    H.Equal(#H.RequestsOf('Inventory.Give'), 0)
    H.Equal(#H.RequestsOf('Inventory.Drop'), 0)
    H.Equal(#H.RequestsOf('Weapons.Attach'), 0)

    local config = H.LastPage('config')

    H.Equal({ config.giving, config.dropping, config.workbench }, { false, false, false })
end)

H.Test('the page gets the layout, and the owner theme on top of ug-lib theme', function()
    H.Reset()
    GlobalState['ug-lib:Config'] = {
        theme = {
            mode = 'dark',
            colors = {
                primary = '1 1% 1%',
                accent = '2 2% 2%',
            },
            radius = '0.5rem',
            font = 'Inter',
            scale = 1,
        },
    }
    H.LoadClient({
        theme = {
            colors = {
                primary = '200 90% 55%',
                weapon = '0 85% 70%',
            },
            scale = 1.2,
        },
        layout = {
            pockets = 'right',
        },
    })

    local config = H.LastPage('config')

    H.Equal(config.theme, {
        mode = 'dark',
        colors = {
            primary = '200 90% 55%',
            accent = '2 2% 2%',
            weapon = '0 85% 70%',
        },
        radius = '0.5rem',
        font = 'Inter',
        scale = 1.2,
    })
    H.Equal(config.layout.pockets, 'right')
    H.Equal(config.toastDuration, 3500)
end)

---Dresses the player ped: a top, underwear legs and a hat. Natives read and change it.
---@param model? string
---@return { components: table<integer, integer[]>, props: table<integer, integer[]> }
local function dressed(model)
    local ped = {
        components = {
            [11] = { 5, 2 },
            [4] = { 61, 0 },
        },
        props = {
            [0] = { 12, 1 },
        },
    }
    local N = H.NativeReturns

    N.GetEntityModel = joaat(model or 'mp_m_freemode_01')
    N.GetPedDrawableVariation = function(_, id)
        return (ped.components[id] or { 0, 0 })[1]
    end
    N.GetPedTextureVariation = function(_, id)
        return (ped.components[id] or { 0, 0 })[2]
    end
    N.GetPedPropIndex = function(_, id)
        return (ped.props[id] or { -1, 0 })[1]
    end
    N.GetPedPropTextureIndex = function(_, id)
        return (ped.props[id] or { -1, 0 })[2]
    end
    N.SetPedComponentVariation = function(_, id, drawable, texture)
        ped.components[id] = { drawable, texture }
    end
    N.SetPedPropIndex = function(_, id, drawable, texture)
        ped.props[id] = { drawable, texture }
    end
    N.ClearPedProp = function(_, id)
        ped.props[id] = nil
    end

    return ped
end

---@param state table the clothing state the page got
---@param piece string
---@return table?
local function slotOf(state, piece)
    for _, slot in ipairs(state.pieces) do
        if slot.piece == piece then
            return slot
        end
    end

    return nil
end

---Dictionaries the player ped (100) played, in order.
---@return string[]
local function playerAnimations()
    local list = {}

    for _, call in ipairs(H.CallsOf('TaskPlayAnim')) do
        if call.args[1] == 100 then
            list[#list + 1] = call.args[2]
        end
    end

    return list
end

H.Test('toggle mode takes pieces off and back on, with an animation, and the slots follow', function()
    H.Reset()

    local ped = dressed()

    H.LoadClient()
    press('open')

    local clothing = H.LastPage('open').clothing

    H.Equal(clothing.mode, 'toggle')
    H.Equal(#clothing.pieces, 14)
    H.Equal(slotOf(clothing, 'top'), {
        piece = 'top',
        worn = true,
        available = true,
        restorable = false,
    })
    H.Equal(slotOf(clothing, 'legs').worn, false, 'underwear is not worn clothing')

    H.PostNui('clothing', {
        id = 1,
        piece = 'hat',
    })
    H.Advance(1000)

    H.Equal(H.LastPage('result'), {
        id = 1,
        ok = true,
    })
    H.Equal(ped.props[0], nil)
    H.Equal(playerAnimations(), { 'mp_masks@standard_car@ds@' })
    H.Equal(slotOf(H.LastPage('clothing'), 'hat'), {
        piece = 'hat',
        worn = false,
        available = true,
        restorable = true,
    })

    H.PostNui('clothing', {
        id = 2,
        piece = 'hat',
    })
    H.Advance(1000)

    H.Equal(ped.props[0], { 12, 1 }, 'the same hat goes back on')

    H.PostNui('clothing', {
        id = 3,
        piece = 'legs',
    })
    H.Advance(1000)

    H.Equal(H.LastPage('result'), {
        id = 3,
        ok = false,
        error = 'not_found',
    })

    H.PostNui('clothing', {
        id = 4,
        piece = 'top',
    })
    H.Advance(1000)

    H.Equal(ped.components[11], { 15, 0 })

    H.TriggerEvent('onResourceStop', 'ug-inventory')

    H.Equal(ped.components[11], { 5, 2 }, 'a stop dresses the player again')
end)

H.Test('owners pick the clothing animations: whole body, or none for a piece left out', function()
    H.Reset()
    local ped = dressed()
    H.LoadClient({
        clothingAnimations = {
            top = {
                dict = 'my@dress',
                name = 'shirt',
                duration = 400,
                upperBody = false,
            },
        },
    })
    press('open')

    H.PostNui('clothing', {
        id = 1,
        piece = 'top',
    })
    H.Advance(1000)

    local onPlayer = nil

    for _, call in ipairs(H.CallsOf('TaskPlayAnim')) do
        if call.args[1] == 100 then
            onPlayer = call
        end
    end

    H.Equal(playerAnimations(), { 'my@dress' })
    local args = assert(onPlayer).args

    H.Equal({ args[6], args[7] }, { 400, 0 }, 'whole body')

    H.PostNui('clothing', {
        id = 2,
        piece = 'hat',
    })
    H.Advance(1000)

    H.Equal(playerAnimations(), { 'my@dress' }, 'no hat animation')
    H.Equal(ped.props[0], nil, 'the hat still comes off')
end)

H.Test('items mode asks the server to take a piece off, and animates when the server dressed the ped', function()
    H.Reset()
    dressed()
    H.LoadClient({
        clothingMode = 'items',
    })
    press('open')

    H.Equal(slotOf(H.LastPage('open').clothing, 'hat').item, 'clothing_hat')

    H.PostNui('clothing', {
        id = 1,
        piece = 'top',
    })
    H.Advance(100)

    H.Equal(H.RequestsOf('Callback.ug-inventory:TakeOff'), { { 'top' } })
    H.Equal(H.LastPage('result'), {
        id = 1,
        ok = true,
    })

    H.CallbackAnswers['ug-inventory:TakeOff'] = {
        true,
        {
            ok = false,
            error = 'cannot_carry',
        },
    }
    H.PostNui('clothing', {
        id = 2,
        piece = 'hat',
    })
    H.Advance(100)

    H.Equal(H.LastPage('result'), {
        id = 2,
        ok = false,
        error = 'cannot_carry',
    })

    H.PostNui('clothing', {
        id = 3,
        piece = 'legs',
    })
    H.Advance(100)

    H.Equal(H.LastPage('result'), {
        id = 3,
        ok = false,
        error = 'not_found',
    })
    H.Equal(#H.RequestsOf('Callback.ug-inventory:TakeOff'), 2, 'nothing to take off: no request')

    local dressed = #H.CallsOf('ClonePedToTarget')

    H.NetHandlers.Dressed('top')
    H.Advance(1000)

    H.Equal(playerAnimations(), { 'clothingtie' })
    H.Equal(#H.CallsOf('ClonePedToTarget'), dressed + 1, 'the preview shows the change')
end)

H.Test('owners MAY hide clothing or show fewer pieces, and add-on peds show props only', function()
    H.Reset()
    dressed()
    H.LoadClient({
        clothing = false,
    })
    press('open')

    H.Equal(H.LastPage('open').clothing, nil)
    H.PostNui('clothing', {
        id = 1,
        piece = 'hat',
    })
    H.Advance(100)
    H.Equal(H.LastPage('result'), {
        id = 1,
        ok = false,
        error = 'invalid_args',
    })
    H.Equal(H.PostNui('clothing', {
        id = 2,
        piece = 'cape',
    }), {
        ok = false,
    })

    H.Reset()
    dressed('a_m_y_skater_01')
    H.LoadClient({
        clothingPieces = { 'hat', 'top' },
    })
    press('open')

    local clothing = H.LastPage('open').clothing

    H.Equal(#clothing.pieces, 2)
    H.Equal(slotOf(clothing, 'hat').available, true)
    H.Equal(slotOf(clothing, 'top').available, false, 'no known drawable without the top')
end)

H.Test('an inventory opened by server code, such as an admin, shows next to the pockets', function()
    H.Reset()
    H.LoadClient()

    local opened = {
        label = 'Player 7',
        slots = 50,
        maxWeight = 30000,
        items = {
            {
                slot = 1,
                name = 'water',
                count = 2,
            },
        },
    }

    H.Fire(UgCore.Enums.Events.Inventory.Opened, opened)

    H.Equal(H.Exports.IsOpen(), true)
    H.Equal(H.LastPage('open').other, {
        kind = 'inventory',
        label = 'Player 7',
        slots = 50,
        maxWeight = 30000,
        items = opened.items,
    })
    H.Equal(emitted(H.Emitted, 'ug-inventory:Opened'), { { 'inventory' } })

    post('move', {
        id = 1,
        from = 'other',
        fromSlot = 1,
        to = 'player',
        toSlot = 2,
        count = 1,
    })

    H.Equal(H.RequestsOf('Inventory.MoveBetween'), { { 'other', 1, 'player', 2, 1 } }, 'items move both ways')

    H.Fire(UgCore.Enums.Events.Inventory.Opened, {
        label = 'Player 9',
        slots = 50,
        maxWeight = 30000,
        items = {},
    })

    H.Equal(H.LastPage('other').label, 'Player 9', 'an open screen only changes the other side')

    press('open')
    H.Advance(100)

    H.Equal(H.Exports.IsOpen(), false)
    H.Equal(#H.RequestsOf('Inventory.Close'), 1, 'closing tells ug-core')
end)

H.Test('nearby players are offered with their character name', function()
    H.Reset()
    H.LoadClient()
    H.NativeReturns.GetActivePlayers = { 0, 1, 2 }
    H.NativeReturns.GetPlayerPed = function(player)
        return 200 + player
    end
    H.NativeReturns.GetEntityCoords = function(entity)
        return entity == 202 and vector3(10.0, 0.0, 0.0) or vector3(1.0, 0.0, 0.0)
    end
    H.NativeReturns.GetPlayerServerId = function(player)
        return player + 10
    end
    H.PlayerStates[11] = {
        [UgCore.Enums.StateBags.Player] = {
            name = 'Lena Ortiz',
            characterId = 3,
        },
    }

    H.Equal(UgInventory.Internal.Screen.NearbyPlayers(), {
        {
            id = 11,
            name = 'Lena Ortiz',
        },
    })
end)

H.Test('drops show a prop near the player and lose it when they go', function()
    H.Reset()
    H.LoadClient()
    H.NativeReturns.CreateObject = 900
    H.NativeReturns.DoesEntityExist = true
    H.Drops = {
        a = vector3(5.0, 0.0, 0.0),
        far = vector3(500.0, 0.0, 0.0),
    }
    UgInventory.Internal.Drops.Refresh()

    H.Equal(#H.CallsOf('CreateObject'), 1)

    H.Drops = {}
    UgInventory.Internal.Drops.Refresh()

    H.Equal(H.CallsOf('DeleteEntity')[1].args[1], 900)
end)

H.Done()
