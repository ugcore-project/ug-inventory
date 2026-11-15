--[[

    ug-inventory - https://github.com/ugcore-project
    Copyright (C) 2026 UgCore Framework & Contributors
    Licensed under the GNU General Public License. See LICENSE for details.

]] --

---@diagnostic disable: undefined-global

fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'ug-inventory'
author 'UgCore Framework & Contributors'
version '1.0.0' -- x-release-please-version
description 'The player inventory for UgCore: drag and drop, a live character preview, hotbar, quick-use wheel, weapons, shops'
repository 'https://github.com/ugcore-project/ug-inventory'

ugcore_version '1.0.0'
uglib_version '1.0.0'

dependencies {
    '/onesync',
    'ug-core',
    'ug-lib',
}

shared_scripts {
    '@ug-core/import.lua',
    '@ug-lib/import.lua',
    'shared/init.lua',
    'shared/enums.lua',
    'shared/clothing.lua',
}

server_scripts {
    'server/config.lua',
    'server/clothing.lua',
    'server/boot.lua',
}

client_scripts {
    'client/nui.lua',
    'client/state.lua',
    'client/sound.lua',
    'client/preview.lua',
    'client/wardrobe.lua',
    'client/screen.lua',
    'client/open.lua',
    'client/hotbar.lua',
    'client/drops.lua',
    'client/boot.lua',
}

ui_page 'web/dist/index.html'

files {
    'locales/*.json',
    'images/*',
    'web/dist/index.html',
    'web/dist/assets/*',
}
