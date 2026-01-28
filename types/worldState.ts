// --- TYPE DEFINITIONS ---
declare global {
  var __firebase_config: any;
  var __app_id: string;
  var __initial_auth_token: string;
}

export interface PlayerStats { str: number; dex: number; con: number; int: number; wis: number; cha: number; }
export interface Item { id?: string; name: string; type: string; rarity?: string; value?: number; weight?: number; effect?: { [key: string]: number }; slot?: string; power?: number; ac?: number; twoHanded?: boolean; statsBonus?: Partial<PlayerStats>; }
export interface Spell { id: string; name: string; cost: number; damage?: number; heal?: number; buff?: string; duration?: number; school: string; target: 'enemy' | 'ally' | 'self'; }
export interface Quest { title: string; description: string; status: 'active' | 'completed'; }
export interface NPC { name: string; role: string; location: string; }
export interface Enemy { name: string; hp: number; hpMax: number; ac: number; damage: string; }
export interface Player { name: string; race: string; class: string; level: number; xp: number; hpMax: number; hpCurrent: number; manaMax: number; manaCurrent: number; staminaMax: number; staminaCurrent: number; currency: number; stats: PlayerStats; inventory: Item[]; equipment: { [key: string]: Item }; spells: Spell[]; quests: Quest[]; factions: { [key: string]: number }; knownNPCs: NPC[]; exhaustion: number; hungerDays: number; thirstDays: number; ac: number; background: string; concept: string; proficiencies: { skills: string[]; savingThrows: string[]; }; personality: { traits: string; ideals: string; bonds: string; flaws: string; }; confiscatedInventory?: Item[]; confiscatedEquipment?: { [key: string]: Item };}
export interface World { day: number; hour: number; weather: string; facts: string[]; eventLog: any[]; }
export interface LogEntry { type: 'player' | 'narration' | 'error' | 'levelup' | 'combat'; text: string; }
export interface Choice { id: string; label: string; intent: 'travel' | 'combat' | 'social' | 'buy' | 'rest' | 'system'; }
export interface RaceData { traits: string[]; speed: number; bonus?: { [key: string]: number }; subraces?: string[]; }
export interface ClassData { hd: number; mana: number; stamina: number; gear: string; savingThrows: string[]; skills: string[]; features: string[]; primaryStats: (keyof PlayerStats)[]; spells?: string[]; }
export interface BackgroundData { skills: string[]; gear: string; feature: string; }

// Monster/Enemy data for the bestiary
export interface MonsterData {
    id: string;
    name: string;
    type: 'beast' | 'humanoid' | 'undead' | 'fiend' | 'dragon' | 'elemental' | 'aberration' | 'construct' | 'celestial' | 'fey' | 'giant' | 'monstrosity' | 'ooze' | 'plant';
    challenge: number; // CR rating (0.125, 0.25, 0.5, 1-30)
    hp: number;
    ac: number;
    damage: string; // e.g., "1d6+2"
    speed: number;
    abilities?: string[];
    immunities?: string[];
    resistances?: string[];
    vulnerabilities?: string[];
    loot?: string[]; // Item IDs that can drop
    xp: number;
    description?: string;
}

// Location data for world areas
export interface LocationData {
    id: string;
    name: string;
    type: 'town' | 'dungeon' | 'wilderness' | 'landmark' | 'ruin' | 'castle' | 'temple' | 'tavern' | 'shop' | 'guild';
    description: string;
    connections: string[]; // IDs of connected locations
    npcs?: string[];
    monsters?: string[]; // Monster IDs that can appear here
    shops?: string[];
    quests?: string[];
    dangerLevel: number; // 0-10
}

// Achievement system
export interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: 'combat' | 'exploration' | 'social' | 'collection' | 'progression' | 'secret';
    requirement: {
        type: 'kills' | 'visits' | 'items' | 'gold' | 'level' | 'quests' | 'spells' | 'custom';
        target?: string; // specific monster/location/item ID
        count: number;
    };
    reward?: {
        xp?: number;
        gold?: number;
        item?: string;
        title?: string;
    };
}