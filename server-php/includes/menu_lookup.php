<?php
// Reads the same menu-data.json the frontend fetches (server-php/ sits
// alongside it in the repo) so ticket routing is decided authoritatively
// here, never trusted from whatever the client sends.

function menu_data(): array {
    static $data = null;
    if ($data !== null) return $data;
    $path = __DIR__ . '/../../menu-data.json';
    $data = json_decode(file_get_contents($path), true);
    return $data;
}

// Falls back to KITCHEN for anything not found (e.g. a renamed menu item)
// rather than silently dropping the ticket.
function print_station_for(string $itemName): string {
    static $map = null;
    if ($map === null) {
        $map = [];
        foreach (menu_data()['categories'] as $cat) {
            foreach ($cat['items'] as $item) {
                $map[$item['name']] = $item['printStation'] ?? 'KITCHEN';
            }
        }
    }
    return $map[$itemName] ?? 'KITCHEN';
}

function restaurant_info(): array {
    return menu_data()['restaurant'];
}
