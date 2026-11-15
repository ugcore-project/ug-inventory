--[[

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

]] --

local H = dofile('tests/helpers.lua')

---@param content string? config.lua content, nil for a first start
---@return string[] lines
local function boot(content)
    H.Reset()

    if content then
        H.Files['config.lua'] = content
    end

    return H.Load('server')
end

print('server')

H.Test('first start copies the example and publishes the defaults', function()
    local lines = boot(nil)

    H.ExpectLine(lines, '[ug-inventory] v1.0.0 ready. 0 stash point(s), weapons on, shops on, clothing toggle.')
    H.Equal(H.Saved['config.lua'], LoadResourceFile('ug-inventory', 'server/config.default.lua'))
    H.Equal(GlobalState['ug-inventory:Config'], H.Defaults())
    H.Equal(GlobalState['ug-inventory:Stashes'], {})
end)

H.Test('weapons, their ammo and attachments are published as categories', function()
    H.Reset()
    H.CoreConfig.weapons = {
        weapons = {
            weapon_pistol = {
                hash = 'WEAPON_PISTOL',
                ammo = 'ammo_9mm',
                components = {
                    pistol_suppressor = 'COMPONENT_AT_PI_SUPP_02',
                },
            },
        },
        tints = {
            weapon_tint_gold = 2,
        },
    }
    H.Load('server')

    H.Equal(GlobalState['ug-inventory:Categories'], {
        weapon_pistol = 'weapon',
        ammo_9mm = 'ammo',
        pistol_suppressor = 'attachment',
        weapon_tint_gold = 'attachment',
    })

    H.Reset()
    H.Modules.weapons = nil
    H.Load('server')

    H.Equal(GlobalState['ug-inventory:Categories'], {}, 'no weapons module, no categories')
end)

H.Test('stashes with a position are published by name, without their contents', function()
    H.Reset()
    H.CoreConfig.inventory.stashes = {
        police = {
            label = 'Evidence',
            slots = 50,
            maxWeight = 100000,
            coords = vector3(440.0, -980.0, 30.0),
            groups = { 'police' },
        },
        apartment = {
            slots = 20,
            maxWeight = 50000,
            coords = vector3(1.0, 2.0, 3.0),
        },
        hidden = {
            label = 'Script only',
            slots = 10,
            maxWeight = 1000,
        },
    }

    H.ExpectLine(H.Load('server'), '2 stash point(s)')
    H.Equal(GlobalState['ug-inventory:Stashes'], {
        {
            name = 'apartment',
            label = 'apartment',
            coords = vector3(1.0, 2.0, 3.0),
        },
        {
            name = 'police',
            label = 'Evidence',
            coords = vector3(440.0, -980.0, 30.0),
        },
    })
end)

H.Test('every bad value is reported and nothing is published', function()
    local lines = boot([[
        return {
            hotbarSlots = 12,
            openKey = 'TAB KEY',
            giveDistanse = 3.0,
        }
    ]])

    H.ExpectLine(lines, 'hotbarSlots')
    H.ExpectLine(lines, 'openKey')
    H.ExpectLine(lines, 'unknown key "giveDistanse". Did you mean "giveDistance"?')
    H.ExpectLine(lines, 'Config invalid: 3 error(s).')
    H.Equal(GlobalState['ug-inventory:Config'], nil)
    H.Equal(GlobalState['ug-inventory:Stashes'], nil)
end)

H.Test('an owner layout keeps the defaults of the fields it leaves out, and owner maps replace the defaults', function()
    boot([[
        return {
            layout = { pockets = 'right', columns = 6 },
            theme = { mode = 'light', colors = { primary = '200 90% 55%', weapon = '0 85% 70%' }, radius = '4px' },
            soundEffects = { open = { name = 'SELECT', set = 'HUD_FRONTEND_DEFAULT_SOUNDSET' } },
            previewAnimations = {},
        }
    ]])

    local published = GlobalState['ug-inventory:Config']
    local layout = H.Defaults().layout

    layout.pockets, layout.columns = 'right', 6

    H.Equal(published.layout, layout)
    H.Equal(published.theme, {
        mode = 'light',
        colors = {
            primary = '200 90% 55%',
            weapon = '0 85% 70%',
        },
        radius = '4px',
    })
    H.Equal(published.soundEffects, {
        open = {
            name = 'SELECT',
            set = 'HUD_FRONTEND_DEFAULT_SOUNDSET',
        },
    }, 'a sound left out is muted')
    H.Equal(published.previewAnimations, {})
end)

H.Test('bad look, layout, sound and animation values are reported', function()
    local lines = boot([[
        return {
            theme = { colors = { primray = '1 1% 1%', accent = 'red' }, radius = 'big' },
            layout = { pockets = 'middle', columns = 20, quantityPresets = { 1, 2, 3, 4, 5, 6, 7 } },
            soundEffects = { boom = { name = 'X', set = 'Y' } },
            clothingAnimations = { hat = { dict = 'a b', name = 'x', duration = 50 } },
            toastDuration = 10,
        }
    ]])

    H.ExpectLine(lines, 'theme')
    H.ExpectLine(lines, 'layout')
    H.ExpectLine(lines, 'soundEffects')
    H.ExpectLine(lines, 'clothingAnimations')
    H.ExpectLine(lines, 'toastDuration')
    H.Equal(GlobalState['ug-inventory:Config'], nil)
end)

H.Test('syntax errors are reported and the sandbox has no os', function()
    H.ExpectLine(boot('return {'), 'config.lua:')
    H.ExpectLine(boot('return os.exit()'), 'config.lua:')
    H.ExpectLine(boot('return 5'), 'MUST return a table')
end)

H.Test('without the items or inventory module it says so and stays off', function()
    for _, name in ipairs({ 'items', 'inventory' }) do
        H.Reset()
        H.Modules[name] = nil

        H.ExpectLine(H.Load('server'), ('needs the %s module'):format(name))
        H.Equal(GlobalState['ug-inventory:Stashes'], nil)
    end
end)

H.Test('optional modules show in the ready line', function()
    H.Reset()
    H.Modules.weapons, H.Modules.shops = nil, nil

    H.ExpectLine(H.Load('server'), 'weapons off, shops off, clothing toggle.')
end)

---ug-appearance as this resource sees it: what the character wears, and every SetClothing it got.
---@return table clothes
---@return table[] saved
local function appearance()
    local clothes = {
        model = 'mp_m_freemode_01',
        components = {
            top = {
                drawable = 5,
                texture = 2,
            },
            legs = {
                drawable = 61,
                texture = 0,
            },
        },
        props = {
            hat = {
                drawable = 12,
                texture = 1,
            },
        },
    }
    local saved = {}

    H.ResourceStates['ug-appearance'] = 'started'
    H.Remote['ug-appearance'] = {
        GetClothing = function()
            return clothes
        end,
        SetClothing = function(_, _, parts)
            saved[#saved + 1] = parts

            for group, list in pairs(parts) do
                for key, part in pairs(list) do
                    clothes[group][key] = part
                end
            end

            return true
        end,
    }

    return clothes, saved
end

---@return string[] lines
local function itemsMode()
    return boot("return { clothingMode = 'items' }")
end

local REASON = 'ug-inventory:clothing'
local MALE = 'mp_m_freemode_01'

H.Test('items mode registers a usable item per piece and the take-off callback', function()
    local lines = itemsMode()

    H.ExpectLine(lines, 'clothing items.')
    H.ExpectLine(lines, 'start ug-appearance before ug-inventory')
    H.Equal(H.Registered.clothing_hat.label, 'Hat')
    H.Equal(H.Registered.clothing_top.stack, false)
    H.Equal(H.Uses.clothing_shoes.options, {
        consume = 0,
    })
    H.Equal(H.Callbacks.TakeOff.options.requireAlive, true)
    H.Equal(GlobalState['ug-inventory:Categories'].clothing_bag, 'clothing')

    boot("return { clothingPieces = { 'hat' } }")

    H.Equal(next(H.Registered), nil, 'toggle mode makes no items')
    H.Equal(H.Callbacks.TakeOff, nil)

    boot("return { clothingMode = 'items', clothingPieces = { 'hat', 'hat' }, clothingNaked = { mp_m_freemode_01 = { hat = 1 } } }")

    H.Equal(GlobalState['ug-inventory:Config'], nil, 'duplicates and props in clothingNaked are refused')
end)

H.Test('a piece comes off as an item, and stays on when it does not fit', function()
    itemsMode()

    local clothes, saved = appearance()

    local takeOff = H.Callbacks.TakeOff.handler

    H.Equal(takeOff(1, 'top'), {
        ok = true,
    })
    H.Equal(H.RequestsOf('Inventory.AddItem'), {
        {
            1,
            'clothing_top',
            1,
            {
                model = MALE,
                drawable = 5,
                texture = 2,
            },
            REASON,
        },
    })
    H.Equal(saved[1], {
        components = {
            top = {
                drawable = 15,
                texture = 0,
            },
        },
    })
    H.Equal(H.Sent[1], {
        target = 1,
        name = 'ug-inventory:Dressed',
        args = { 'top' },
    })
    H.Equal(takeOff(1, 'top'), {
        ok = false,
        error = 'not_found',
    }, 'nothing left to take off')
    H.Equal(takeOff(1, 'legs'), {
        ok = false,
        error = 'not_found',
    }, 'underwear stays')

    H.Answers['Inventory.AddItem'] = { false, 'cannot_carry' }
    H.Equal(takeOff(1, 'hat'), {
        ok = false,
        error = 'cannot_carry',
    })
    H.Equal(clothes.props.hat.drawable, 12, 'the hat stays on')

    H.Answers['Inventory.AddItem'] = nil
    H.Remote['ug-appearance'].SetClothing = function()
        return false, 'no_permission'
    end
    H.Equal(takeOff(1, 'hat'), {
        ok = false,
        error = 'no_permission',
    })
    H.Equal(H.RequestsOf('Inventory.RemoveItem'), {
        {
            1,
            'clothing_hat',
            1,
            {
                model = MALE,
                drawable = 12,
                texture = 1,
            },
            REASON,
        },
    }, 'the item goes back')

    H.ResourceStates['ug-appearance'] = 'stopped'
    H.Equal(takeOff(1, 'hat'), {
        ok = false,
        error = 'not_found',
    })
end)

H.Test('using a clothing item wears it and takes off the piece in its place', function()
    itemsMode()

    local clothes = appearance()

    local wear = H.Uses.clothing_top.handler
    local shirt = {
        model = MALE,
        drawable = 9,
        texture = 0,
    }

    H.Equal(wear(1, {
        slot = 4,
        name = 'clothing_top',
        metadata = shirt,
    }), true)
    H.Equal(H.RequestsOf('Inventory.RemoveFromSlot'), { { 1, 4, 1, REASON } })
    H.Equal(H.RequestsOf('Inventory.AddItem'), {
        {
            1,
            'clothing_top',
            1,
            {
                model = MALE,
                drawable = 5,
                texture = 2,
            },
            REASON,
        },
    })
    H.Equal(clothes.components.top, {
        drawable = 9,
        texture = 0,
    })

    local female = {
        model = 'mp_f_freemode_01',
        drawable = 3,
        texture = 0,
    }

    H.Equal(wear(1, {
        slot = 5,
        name = 'clothing_top',
        metadata = female,
    }), false, 'made for another body')
    H.Equal(wear(1, {
        slot = 5,
        name = 'clothing_top',
        metadata = {
            model = MALE,
            drawable = -5,
            texture = 0,
        },
    }), false)
    H.Equal(#H.RequestsOf('Inventory.RemoveFromSlot'), 1)

    H.Remote['ug-appearance'].SetClothing = function()
        return false, 'internal_error'
    end
    H.Requests = {}
    H.Equal(wear(1, {
        slot = 6,
        name = 'clothing_top',
        metadata = shirt,
    }), false)
    H.Equal(H.RequestsOf('Inventory.RemoveItem'), {
        {
            1,
            'clothing_top',
            1,
            {
                model = MALE,
                drawable = 9,
                texture = 0,
            },
            REASON,
        },
    })
    H.Equal(H.RequestsOf('Inventory.AddItem')[2], { 1, 'clothing_top', 1, shirt, REASON }, 'the used item comes back')
end)

H.Test('one clothing change at a time per player', function()
    itemsMode()
    appearance()

    local remote = H.Remote['ug-appearance']
    local get = remote.GetClothing

    remote.GetClothing = function(...)
        Wait(100)

        return get(...)
    end

    local first = nil

    CreateThread(function()
        first = H.Callbacks.TakeOff.handler(1, 'top')
    end)

    H.Equal(H.Callbacks.TakeOff.handler(1, 'hat'), {
        ok = false,
        error = 'rate_limited',
    })
    H.Advance(200)
    H.Equal(first, {
        ok = true,
    })
end)

H.Test('nothing starts when ug-core never gets ready', function()
    H.Reset()
    H.CoreReady = false

    H.ExpectLine(H.Load('server'), 'ug-core did not become ready')
    H.Equal(GlobalState['ug-inventory:Config'], nil)
end)

H.Done()
