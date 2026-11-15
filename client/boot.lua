--[[

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

]] --

-- Last client script: waits for the server config and ug-core, then registers the keys and starts every part.

local Internal = UgInventory.Internal

local STATE_KEY = 'ug-inventory:Config'
local READY_TIMEOUT = 60000

CreateThread(function()
    local deadline = GetGameTimer() + READY_TIMEOUT

    while type(GlobalState[STATE_KEY]) ~= 'table' do
        if GetGameTimer() >= deadline then
            print('^1[ug-inventory] No config from the server. Check the server console.^7')

            return
        end

        Wait(250)
    end

    if not UgCore.Lifecycle.Await(UgCore.Enums.Lifecycle.Ready, READY_TIMEOUT) then
        print('^1[ug-inventory] ug-core did not become ready.^7')

        return
    end

    if not UgCore.Modules.IsEnabled('items') or not UgCore.Modules.IsEnabled('inventory') then
        print('^1[ug-inventory] ug-core needs the items and inventory modules.^7')

        return
    end

    local settings = GlobalState[STATE_KEY] --[[@as table]]
    local label = UgLib.Locale.Create()

    UgLib.Keybind.Register({
        name = 'open',
        label = label('keybind.open'),
        defaultKey = settings.openKey,
        onPressed = Internal.Open.Toggle,
    })

    Internal.State.Start(settings)
    Internal.Wardrobe.Start(settings)
    Internal.Screen.Start(settings)
    Internal.Open.Start(settings)
    Internal.Hotbar.Start(settings, label)
    Internal.Drops.Start(settings)

    print(('[ug-inventory] Ready: hotbar %d, wheel %d.'):format(settings.hotbarSlots, settings.wheelSlots))
end)
