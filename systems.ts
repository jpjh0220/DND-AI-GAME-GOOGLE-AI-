import { Player, World, LogEntry, Choice, Item, PlayerStats, Spell } from './types/worldState';
import { CLASSES, ITEMS_DB, RACES, BACKGROUNDS, SPELLS_DB } from './registries';

export const assignDefaultStats = (raceName: string, className: string): PlayerStats => {
    const classData = CLASSES[className];
    const raceData = RACES[raceName];
    if (!classData || !raceData) {
        return { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    }

    const standardArray = [15, 14, 13, 12, 10, 8];
    const stats: PlayerStats = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
    const assignedStats: (keyof PlayerStats)[] = [];
    const allStatKeys: (keyof PlayerStats)[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

    // 1. Assign primary stats from class data
    const primaryStats = classData.primaryStats;
    stats[primaryStats[0]] = standardArray.shift()!;
    assignedStats.push(primaryStats[0]);
    
    if (primaryStats[1] && !assignedStats.includes(primaryStats[1])) {
        stats[primaryStats[1]] = standardArray.shift()!;
        assignedStats.push(primaryStats[1]);
    }

    // 2. Assign remaining scores to other stats in a fixed order
    for (const statKey of allStatKeys) {
        if (!assignedStats.includes(statKey)) {
            stats[statKey] = standardArray.shift()!;
        }
    }

    // 3. Apply racial bonuses
    if (raceData.bonus) {
        for (const [stat, bonus] of Object.entries(raceData.bonus)) {
            if (stat === 'all') {
                allStatKeys.forEach(s => stats[s] += bonus);
            } else {
                stats[stat as keyof PlayerStats] += bonus;
            }
        }
    }
    
    return stats;
};

export const getSpellcastingAbility = (className: string): keyof PlayerStats => {
    switch (className) {
        case 'Wizard':
        case 'Artificer':
            return 'int';
        case 'Cleric':
        case 'Druid':
        case 'Ranger':
            return 'wis';
        case 'Bard':
        case 'Paladin':
        case 'Sorcerer':
        case 'Warlock':
            return 'cha';
        default:
            return 'int'; // Fallback
    }
};

export const ALL_SKILLS: { [key: string]: keyof PlayerStats } = {
    'Acrobatics': 'dex',
    'Animal Handling': 'wis',
    'Arcana': 'int',
    'Athletics': 'str',
    'Deception': 'cha',
    'History': 'int',
    'Insight': 'wis',
    'Intimidation': 'cha',
    'Investigation': 'int',
    'Medicine': 'wis',
    'Nature': 'int',
    'Perception': 'wis',
    'Performance': 'cha',
    'Persuasion': 'cha',
    'Religion': 'int',
    'Sleight of Hand': 'dex',
    'Stealth': 'dex',
    'Survival': 'wis',
};


// --- CHARACTER ---
export const createCharacter = (data: Player) => {
    const cls = CLASSES[data.class];
    const race = RACES[data.race];
    const background = BACKGROUNDS[data.background];
    
    // NOTE: Racial stat bonuses are now applied during the assignment phase in CharacterCreator,
    // so we don't need to re-apply them here. We just use the stats that are passed in.
    
    const conMod = getMod(data.stats.con);
    const hp = cls.hd + conMod;

    const initialPlayer: Player = { 
        ...data,
        hpMax: hp, hpCurrent: hp, 
        manaMax: cls.mana, manaCurrent: cls.mana, 
        staminaMax: cls.stamina, staminaCurrent: cls.stamina, 
        inventory: [ITEMS_DB.find(i => i.id === 'ration'), ITEMS_DB.find(i => i.id === 'waterskin')].filter(Boolean) as Item[],
        spells: [],
    };

    const startingGear = [...(cls.gear.split(', ')), ...(background.gear.split(', '))];
    startingGear.forEach(gearName => {
        const item = ITEMS_DB.find(i => i.name === gearName.trim());
        if(item) {
            initialPlayer.inventory.push(item);
        } else {
            initialPlayer.inventory.push({ name: gearName, type: "gear", weight: 1, value: 10 } as Item)
        }
    });

    if (cls.spells) {
        initialPlayer.spells = cls.spells
            .map(spellId => SPELLS_DB.find(s => s.id === spellId))
            .filter((s): s is Spell => s !== undefined);
    }

    initialPlayer.ac = calculatePlayerAC(initialPlayer);
    
    const initialWorld: World = { day: 1, hour: 8, weather: "Clear", facts: ["Arrived at Oakhaven"], eventLog: [] };
    const startLog: LogEntry[] = [{ type: 'narration', text: `Welcome, ${data.name}. You stand at the gates of Oakhaven.` }];
    const startChoices: Choice[] = [{ id: 'enter', label: 'Enter Town', intent: 'travel' }];
    
    return { player: initialPlayer, world: initialWorld, log: startLog, choices: startChoices };
};

export const calculateXpToNextLevel = (level: number): number => {
  return (level * 100) + 150;
};

const rollHitDie = (hd: number): number => {
    return Math.floor(Math.random() * hd) + 1;
}

export const handleLevelUp = (player: Player): { player: Player, messages: string[] } => {
    const nextPlayer = { ...player };
    const messages: string[] = [];
    
    nextPlayer.level += 1;
    
    const classData = CLASSES[nextPlayer.class];
    const conMod = getMod(nextPlayer.stats.con);
    const hpGain = rollHitDie(classData.hd) + conMod;
    nextPlayer.hpMax += Math.max(1, hpGain);
    
    nextPlayer.hpCurrent = nextPlayer.hpMax;
    nextPlayer.manaCurrent = nextPlayer.manaMax;
    nextPlayer.staminaCurrent = nextPlayer.staminaMax;

    messages.push(`LEVEL UP! You are now Level ${nextPlayer.level}! You feel stronger. (HP +${hpGain})`);

    return { player: nextPlayer, messages };
};

// --- SURVIVAL ---
export const checkSurvival = (p: Player) => {
    const messages: string[] = [];
    const player = { ...p, inventory: [...p.inventory] };
    let rationIdx = (player.inventory || []).findIndex(i => i.id === 'ration');
    let waterIdx = (player.inventory || []).findIndex(i => i.id === 'waterskin');
    if (rationIdx > -1) { player.inventory.splice(rationIdx, 1); player.hungerDays = 0; messages.push("Consumed 1 Ration."); } else { player.hungerDays += 1; if (player.hungerDays > 3) { player.exhaustion += 1; messages.push("Starving! Exhaustion +1."); } }
    if (waterIdx > -1) { player.thirstDays = 0; messages.push("Drank water."); } else { player.thirstDays += 1; player.exhaustion += 1; messages.push("Dehydrated! Exhaustion +1."); }
    return { player, messages };
};

// --- UTILS / DERIVED STATS ---
export const formatCurrency = (c: number) => { 
    if (isNaN(c)) return "0c"; 
    const g = Math.floor(c / 10000); 
    const s = Math.floor((c % 10000) / 100); 
    const copper = c % 100;
    return `${g}g ${s}s ${copper}c`; 
};

export const getMod = (score: number) => Math.floor(((score || 10) - 10) / 2);

export const calculateEncumbrance = (inventory: Item[]) => (inventory || []).reduce((total, item) => total + (item.weight || 0), 0);

export const calculateMaxCarry = (str: number) => (str || 10) * 15;

export const calculatePlayerAC = (player: Player): number => {
    let totalAC = 0;
    const armorItems = Object.values(player.equipment).filter(item => item && typeof item.ac === 'number');
    
    if (armorItems.length === 0) {
        return 10 + getMod(player.stats.dex); // Unarmored AC
    }
    // Simplified AC: Sum of all equipped items with an AC value.
    armorItems.forEach(item => {
        totalAC += item.ac || 0;
    });
    return totalAC;
};