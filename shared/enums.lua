--[[

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

]] --

-- Every magic value lives here. Error codes come from UgCore.Enums.Errors, never from strings.

---@class UgInventory.Enums
UgInventory.Enums = {}

---Client events this resource emits through UgCore.Events. Names MUST start with the resource name.
---@enum UgInventoryScreenEvent
UgInventory.Enums.Events = {
    -- (kind?) when the screen opens, kind being the container opened next to the player's inventory.
    Opened = 'ug-inventory:Opened',
    Closed = 'ug-inventory:Closed',
}

---Inventory references, as ug-core names them: the player's own, and the one opened next to it.
---@enum UgInventorySide
UgInventory.Enums.Side = {
    Player = 'player',
    Other = 'other',
}

---What can open next to the player's inventory.
---@enum UgInventoryKind
UgInventory.Enums.Kind = {
    Stash = 'stash',
    Trunk = 'trunk',
    Glovebox = 'glovebox',
    Drop = 'drop',
    Shop = 'shop',
    -- Opened by server code, such as an admin or a search: another player's pockets, a house stash.
    Inventory = 'inventory',
}

---What an item is, for its colour on the page. Weapons, ammo and attachments come from ug-core's weapons config.
---@enum UgInventoryCategory
UgInventory.Enums.Category = {
    Weapon = 'weapon',
    Ammo = 'ammo',
    Attachment = 'attachment',
    Consumable = 'consumable',
    Clothing = 'clothing',
    Item = 'item',
}

---Clothing pieces the screen shows next to the character. MUST match web/src/types/protocol.ts.
---@enum UgInventoryClothingPiece
UgInventory.Enums.ClothingPiece = {
    Hat = 'hat',
    Glasses = 'glasses',
    Ears = 'ears',
    Mask = 'mask',
    Chain = 'chain',
    Top = 'top',
    Undershirt = 'undershirt',
    Gloves = 'gloves',
    Vest = 'vest',
    Bag = 'bag',
    Watch = 'watch',
    Bracelet = 'bracelet',
    Legs = 'legs',
    Shoes = 'shoes',
}

---How clothing works: pieces come off and back on the ped, or come off as items worn again by using them.
---MUST match web/src/types/protocol.ts.
---@enum UgInventoryClothingMode
UgInventory.Enums.ClothingMode = {
    Toggle = 'toggle',
    Items = 'items',
}

---Screen sounds. The page MAY ask for Hover, Pick and Menu, Lua plays the rest. MUST match web/src/types/protocol.ts.
---@enum UgInventorySound
UgInventory.Enums.Sound = {
    Open = 'open',
    Close = 'close',
    Hover = 'hover',
    Pick = 'pick',
    Menu = 'menu',
    Move = 'move',
    Use = 'use',
    Give = 'give',
    Drop = 'drop',
    Buy = 'buy',
    Attach = 'attach',
    Detach = 'detach',
    Reload = 'reload',
    Error = 'error',
}

---GlobalState keys this resource writes.
---@enum UgInventoryGlobalState
UgInventory.Enums.GlobalState = {
    Config = 'ug-inventory:Config',
    Stashes = 'ug-inventory:Stashes',
    Categories = 'ug-inventory:Categories',
}

---Messages Lua sends to the page. MUST match web/src/types/protocol.ts.
---@enum UgInventoryNuiAction
UgInventory.Enums.NuiAction = {
    Config = 'config',
    Open = 'open',
    Close = 'close',
    Update = 'update',
    Other = 'other',
    OtherClosed = 'otherClosed',
    Equipped = 'equipped',
    Result = 'result',
    Toast = 'toast',
    Hotbar = 'hotbar',
    Wheel = 'wheel',
    WheelClose = 'wheelClose',
    Clothing = 'clothing',
}

---Callbacks the page posts. MUST match web/src/types/protocol.ts.
---@enum UgInventoryNuiCallback
UgInventory.Enums.NuiCallback = {
    Ready = 'ready',
    Close = 'close',
    Move = 'move',
    Use = 'use',
    Give = 'give',
    Drop = 'drop',
    Buy = 'buy',
    Attach = 'attach',
    Detach = 'detach',
    Reload = 'reload',
    Unload = 'unload',
    WheelPick = 'wheelPick',
    Sound = 'sound',
    Clothing = 'clothing',
}
