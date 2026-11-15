--[[

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

]] --

-- ug-inventory config. Copied to config.lua in the resource folder on the first start: edit that file, never this one.
-- Updates never overwrite config.lua. A key you remove uses its default.
-- Slots, weights, stashes, trunks, drops, items, weapons and shops are ug-core config: config/inventory.lua and others.

return {
    -- Key that opens the inventory, with whatever is in reach next to it. Players MAY rebind it.
    openKey = 'TAB',

    -- Key held to show the quick-use wheel. Players MAY rebind it.
    wheelKey = 'Z',

    -- Slots 1 to N of the player inventory are the hotbar, used with keys 1 to N. At most 9.
    hotbarSlots = 5,

    -- Slots 1 to N of the player inventory on the quick-use wheel. At most 10.
    wheelSlots = 8,

    -- How close, in meters, the player stands to what the open key opens. ug-core checks every distance again.
    trunkDistance = 1.5,
    dropDistance = 2.0,
    stashDistance = 2.0,
    shopDistance = 2.5,

    -- How close, in meters, another player stands to be offered as a give target. ug-core checks it again.
    giveDistance = 3.0,

    -- The open key skips the trunks of locked vehicles.
    respectLocks = true,

    -- Shows the character in the middle of the screen, the way the pause menu shows it.
    pedPreview = true,

    -- Shows items gained and lost at the edge of the screen, even with the inventory closed.
    toasts = true,

    -- Plays game sounds for opening, hovering, picking up and every action of the screen.
    sounds = true,

    -- Shows clothing slots on both sides of the character. false hides them.
    clothing = true,

    -- 'toggle': a click takes a piece off and puts it back on. Nothing becomes an item.
    -- 'items': a piece comes off as an item (clothing_hat, clothing_top, ...) that MAY be stored, given or dropped,
    -- and is worn again by using it or dragging it onto its slot. Needs ug-appearance, which saves what is worn.
    -- ug-appearance outfits and uniforms still dress for free: give clothing items no resale value.
    clothingMode = 'toggle',

    -- Slots shown, in order: the first half on the left of the character, the rest on the right.
    -- hat, glasses, ears, mask, chain, top, undershirt, gloves, vest, bag, watch, bracelet, legs, shoes.
    clothingPieces = {
        'hat', 'glasses', 'ears', 'mask', 'chain', 'top', 'undershirt',
        'gloves', 'vest', 'bag', 'watch', 'bracelet', 'legs', 'shoes',
    },

    -- Drawable a model wears without a piece, for the pieces that are ped components. The freemode models have
    -- defaults: add-on peds need their own. Example: { mp_f_freemode_01 = { legs = 15 } }.
    clothingNaked = {},

    -- Hides the GTA weapon wheel and its keys: weapons come from the inventory.
    disableWeaponWheel = true,

    -- Prop shown at ground drops, and how far away, in meters, it shows.
    dropModel = 'prop_paper_bag_small',
    dropRenderDistance = 40.0,

    -- Features players see. Off hides the action and the screen refuses it. ug-core still decides every action.
    giving = true,    -- give items to players nearby
    dropping = true,  -- drop items on the ground
    workbench = true, -- inspect a weapon and change its attachments

    -- How long, in ms, an item gained or lost stays at the edge of the screen.
    toastDuration = 3500,

    -- The look of this screen. Every UgCore screen follows ug-lib's theme (ug-lib config/theme.lua): set values here
    -- only to change this screen. Any field MAY be left out.
    --   mode   = 'dark' or 'light'
    --   colors = HSL triplets such as '258 90% 66%'. ug-lib's tokens (background, foreground, card, primary, accent,
    --            destructive, success, warning, muted, border, ...) and this screen's own:
    --            weapon, ammo, attachment, consumable, clothing, item (category colors), overlay (darkens the sides)
    --   radius = corner radius, such as '0.75rem' or '12px'
    --   font   = 'Inter'
    --   scale  = 0.75 to 1.5
    -- Example: theme = { colors = { primary = '200 90% 55%', weapon = '0 85% 70%' }, radius = '4px' },
    theme = {},

    -- Where things are and what shows. Leave out a field to keep its default.
    layout = {
        pockets = 'left',                 -- side of the player's pockets: 'left' or 'right'
        columns = 5,                      -- slots per row, 3 to 10
        slotSize = 5.1,                   -- slot size in rem, 3.5 to 8. Panels grow with columns and slot size.
        vignette = true,                  -- darkens the sides so panels read over any scene
        hints = true,                     -- mouse hints under the character
        quantityBar = true,               -- the quantity picker under the character
        quantityPresets = { 1, 5, 10, 50 }, -- quantity buttons, at most 6. 'All' is always there.
        closeButton = true,               -- the X in the corner
        hotbar = 'bottom',                -- where the hotbar shows: 'bottom' or 'top'
        toasts = 'bottom-right',          -- 'bottom-right', 'bottom-left', 'top-right' or 'top-left'
        animations = true,                -- false: panels appear without motion
    },

    -- Game sounds, { name, set } of PlaySoundFrontend. Remove a line to mute that sound. sounds = false mutes all.
    soundEffects = {
        open = {
            name = 'SELECT',
            set = 'HUD_FRONTEND_DEFAULT_SOUNDSET',
        },
        close = {
            name = 'BACK',
            set = 'HUD_FRONTEND_DEFAULT_SOUNDSET',
        },
        hover = {
            name = 'NAV_UP_DOWN',
            set = 'HUD_FRONTEND_DEFAULT_SOUNDSET',
        },
        pick = {
            name = 'NAV_LEFT_RIGHT',
            set = 'HUD_FRONTEND_DEFAULT_SOUNDSET',
        },
        menu = {
            name = 'SELECT',
            set = 'HUD_FRONTEND_DEFAULT_SOUNDSET',
        },
        move = {
            name = 'PICK_UP',
            set = 'HUD_FRONTEND_DEFAULT_SOUNDSET',
        },
        use = {
            name = 'CONTINUE',
            set = 'HUD_FRONTEND_DEFAULT_SOUNDSET',
        },
        give = {
            name = 'CONTINUE',
            set = 'HUD_FRONTEND_DEFAULT_SOUNDSET',
        },
        drop = {
            name = 'CANCEL',
            set = 'HUD_FRONTEND_DEFAULT_SOUNDSET',
        },
        buy = {
            name = 'PURCHASE',
            set = 'HUD_LIQUOR_STORE_SOUNDSET',
        },
        attach = {
            name = 'WEAPON_ATTACHMENT_EQUIP',
            set = 'HUD_AMMO_SHOP_SOUNDSET',
        },
        detach = {
            name = 'WEAPON_ATTACHMENT_UNEQUIP',
            set = 'HUD_AMMO_SHOP_SOUNDSET',
        },
        reload = {
            name = 'WEAPON_AMMO_PURCHASE',
            set = 'HUD_AMMO_SHOP_SOUNDSET',
        },
        error = {
            name = 'ERROR',
            set = 'HUD_FRONTEND_DEFAULT_SOUNDSET',
        },
    },

    -- What the character preview plays: idle while open, the others after a give, buy or drop went through.
    -- duration is how long, in ms, a reaction plays before the idle comes back. Remove a line to play nothing.
    previewAnimations = {
        idle = {
            dict = 'anim@heists@heist_corona@single_team',
            name = 'single_team_loop_boss',
        },
        give = {
            dict = 'mp_common',
            name = 'givetake1_a',
            duration = 1600,
        },
        buy = {
            dict = 'mp_common',
            name = 'givetake1_a',
            duration = 1600,
        },
        drop = {
            dict = 'random@domestic',
            name = 'pickup_low',
            duration = 1300,
        },
    },

    -- What the player plays while a clothing piece comes off or goes on. The piece changes halfway through duration.
    -- upperBody = false plays it on the whole body, so the player stops moving. Remove a line to play nothing.
    clothingAnimations = {
        hat = {
            dict = 'mp_masks@standard_car@ds@',
            name = 'put_on_mask',
            duration = 600,
        },
        mask = {
            dict = 'mp_masks@standard_car@ds@',
            name = 'put_on_mask',
            duration = 800,
        },
        glasses = {
            dict = 'clothingspecs',
            name = 'take_off',
            duration = 1400,
        },
        ears = {
            dict = 'mp_cp_stolen_tut',
            name = 'b_think',
            duration = 900,
        },
        chain = {
            dict = 'clothingtie',
            name = 'try_tie_positive_a',
            duration = 2100,
        },
        top = {
            dict = 'clothingtie',
            name = 'try_tie_negative_a',
            duration = 1200,
        },
        undershirt = {
            dict = 'clothingtie',
            name = 'try_tie_negative_a',
            duration = 1200,
        },
        vest = {
            dict = 'clothingtie',
            name = 'try_tie_negative_a',
            duration = 1200,
        },
        gloves = {
            dict = 'nmt_3_rcm-10',
            name = 'cs_nigel_dual-10',
            duration = 1200,
        },
        watch = {
            dict = 'nmt_3_rcm-10',
            name = 'cs_nigel_dual-10',
            duration = 1200,
        },
        bracelet = {
            dict = 'nmt_3_rcm-10',
            name = 'cs_nigel_dual-10',
            duration = 1200,
        },
        bag = {
            dict = 'anim@heists@ornate_bank@grab_cash',
            name = 'intro',
            duration = 1600,
        },
        legs = {
            dict = 're@construction',
            name = 'out_of_breath',
            duration = 1300,
        },
        shoes = {
            dict = 'random@domestic',
            name = 'pickup_low',
            duration = 1200,
            upperBody = false,
        },
    },
}
