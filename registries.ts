import { RaceData, ClassData, Item, Spell, BackgroundData } from './types/worldState';

export const RACES: { [key: string]: RaceData } = {
  "Human": { traits: ["Versatile", "Ambitious"], speed: 30, bonus: { all: 1 } },
  "Elf": { subraces: ["High", "Wood", "Drow", "Eladrin", "Shadar-kai", "Sea", "Astral"], traits: ["Darkvision", "Keen Senses"], speed: 30 },
  "Dwarf": { subraces: ["Hill", "Mountain", "Duergar"], traits: ["Darkvision", "Resilience"], speed: 25 },
  "Halfling": { subraces: ["Lightfoot", "Stout"], traits: ["Lucky", "Brave"], speed: 25 },
  "Gnome": { subraces: ["Forest", "Rock", "Deep"], traits: ["Cunning"], speed: 25 },
  "Dragonborn": { subraces: ["Chromatic", "Metallic", "Gem"], traits: ["Breath Weapon"], speed: 30 },
  "Tiefling": { traits: ["Darkvision", "Hellish Resistance"], speed: 30 },
  "Half-Orc": { traits: ["Relentless Endurance"], speed: 30 },
  "Half-Elf": { traits: ["Fey Ancestry"], speed: 30 },
  "Aarakocra": { traits: ["Flight"], speed: 25 }, "Aasimar": { traits: ["Healing Hands", "Light Bearer"], speed: 30 }, "Bugbear": { traits: ["Long Limbed", "Sneaky"], speed: 30 }, "Centaur": { traits: ["Charge", "Equine Build"], speed: 40 }, "Changeling": { traits: ["Shapechanger"], speed: 30 }, "Dhampir": { traits: ["Spider Climb", "Vampiric Bite"], speed: 35 }, "Fairy": { traits: ["Flight", "Fey Magic"], speed: 30 }, "Firbolg": { traits: ["Hidden Step", "Speech of Beast"], speed: 30 }, "Genasi": { subraces: ["Air", "Earth", "Fire", "Water"], traits: ["Elemental Legacy"], speed: 30 }, "Gith": { subraces: ["Githyanki", "Githzerai"], traits: ["Psionics"], speed: 30 }, "Goblin": { traits: ["Nimble Escape"], speed: 30 }, "Goliath": { traits: ["Stone's Endurance"], speed: 30 }, "Harengon": { traits: ["Rabbit Hop", "Lucky Footwork"], speed: 30 }, "Kenku": { traits: ["Mimicry"], speed: 30 }, "Kobold": { traits: ["Pack Tactics"], speed: 30 }, "Leonin": { traits: ["Daunting Roar"], speed: 35 }, "Lizardfolk": { traits: ["Natural Armor", "Bite"], speed: 30 }, "Minotaur": { traits: ["Horns", "Hammering Horns"], speed: 30 }, "Orc": { traits: ["Adrenaline Rush"], speed: 30 }, "Satyr": { traits: ["Magic Resistance", "Mirthful Leaps"], speed: 35 }, "Shifter": { traits: ["Shifting"], speed: 30 }, "Tabaxi": { traits: ["Feline Agility", "Claws"], speed: 30 }, "Tortle": { traits: ["Natural Armor", "Shell Defense"], speed: 30 }, "Triton": { traits: ["Amphibious", "Control Air/Water"], speed: 30 }, "Warforged": { traits: ["Constructed Resilience", "Integrated Protection"], speed: 30 }, "Yuan-Ti": { traits: ["Magic Resistance", "Poison Immunity"], speed: 30 }, "Autognome": { traits: ["Built for Success"], speed: 30 }, "Giff": { traits: ["Firearms Knowledge"], speed: 30 }, "Hadozee": { traits: ["Glide"], speed: 30 }, "Locathah": { traits: ["Leviathan Will"], speed: 30 }, "Owlin": { traits: ["Silent Flight"], speed: 30 }, "Plasmoid": { traits: ["Amorphous"], speed: 30 }, "Reborn": { traits: ["Deathless Nature"], speed: 30 }, "Thri-kreen": { traits: ["Chameleon Carapace"], speed: 30 }, "Verdan": { traits: ["Telepathic Insight"], speed: 30 }
};
export const CLASSES: { [key: string]: ClassData } = {
  "Fighter": { hd: 10, mana: 0, stamina: 15, gear: "Chain Mail, Iron Longsword, Wooden Shield", savingThrows: ["str", "con"], skills: ["Acrobatics", "Athletics"], features: ["Second Wind", "Fighting Style"], primaryStats: ['str', 'con'] }, 
  "Wizard": { hd: 6, mana: 15, stamina: 5, gear: "Robes, Staff, Book", savingThrows: ["int", "wis"], skills: ["Arcana", "History"], features: ["Spellcasting", "Arcane Recovery"], primaryStats: ['int', 'wis'], spells: ['firebolt', 'shield'] }, 
  "Rogue": { hd: 8, mana: 0, stamina: 12, gear: "Leather Armor, Dagger", savingThrows: ["dex", "int"], skills: ["Acrobatics", "Stealth", "Sleight of Hand"], features: ["Sneak Attack", "Thieves' Cant"], primaryStats: ['dex', 'cha'] }, 
  "Cleric": { hd: 8, mana: 12, stamina: 8, gear: "Scale Mail, Mace", savingThrows: ["wis", "cha"], skills: ["Insight", "Religion"], features: ["Spellcasting", "Divine Domain"], primaryStats: ['wis', 'cha'], spells: ['heal'] }, 
  "Barbarian": { hd: 12, mana: 0, stamina: 15, gear: "Hide Armor, Axe", savingThrows: ["str", "con"], skills: ["Athletics", "Survival"], features: ["Rage", "Unarmored Defense"], primaryStats: ['str', 'con'] }, 
  "Ranger": { hd: 10, mana: 6, stamina: 10, gear: "Leather Armor, Bow", savingThrows: ["str", "dex"], skills: ["Animal Handling", "Survival"], features: ["Favored Enemy", "Natural Explorer"], primaryStats: ['dex', 'wis'] }, 
  "Paladin": { hd: 10, mana: 6, stamina: 10, gear: "Chain Mail, Hammer", savingThrows: ["wis", "cha"], skills: ["Athletics", "Persuasion"], features: ["Divine Sense", "Lay on Hands"], primaryStats: ['str', 'cha'], spells: ['heal'] }, 
  "Monk": { hd: 8, mana: 4, stamina: 15, gear: "Robes, Staff", savingThrows: ["str", "dex"], skills: ["Acrobatics", "Insight"], features: ["Unarmored Defense", "Martial Arts"], primaryStats: ['dex', 'wis'] }, 
  "Sorcerer": { hd: 6, mana: 15, stamina: 3, gear: "Dagger, Arcane Focus", savingThrows: ["con", "cha"], skills: ["Arcana", "Deception"], features: ["Spellcasting", "Sorcerous Origin"], primaryStats: ['cha', 'con'], spells: ['firebolt'] }, 
  "Warlock": { hd: 8, mana: 10, stamina: 5, gear: "Spear, Component Pouch", savingThrows: ["wis", "cha"], skills: ["Arcana", "Intimidation"], features: ["Otherworldly Patron", "Pact Magic"], primaryStats: ['cha', 'int'], spells: ['firebolt'] }, 
  "Artificer": { hd: 8, mana: 8, stamina: 5, gear: "Thieves' Tools, Crossbow", savingThrows: ["con", "int"], skills: ["Arcana", "Investigation"], features: ["Magical Tinkering", "Infuse Item"], primaryStats: ['int', 'con'], spells: ['firebolt'] }, 
  "Bard": { hd: 8, mana: 12, stamina: 5, gear: "Lute, Leather Armor", savingThrows: ["dex", "cha"], skills: ["Performance", "Persuasion"], features: ["Bardic Inspiration", "Spellcasting"], primaryStats: ['cha', 'dex'], spells: ['heal'] }, 
  "Druid": { hd: 8, mana: 12, stamina: 5, gear: "Scimitar, Wooden Shield", savingThrows: ["int", "wis"], skills: ["Nature", "Survival"], features: ["Druidic", "Spellcasting"], primaryStats: ['wis', 'con'], spells: ['heal'] }
};
export const BACKGROUNDS: { [key: string]: BackgroundData } = {
    "Acolyte": { skills: ["Insight", "Religion"], gear: "Holy Symbol, Prayer Book", feature: "Shelter of the Faithful" },
    "Soldier": { skills: ["Athletics", "Intimidation"], gear: "Insignia of Rank, Trophy", feature: "Military Rank" },
    "Criminal": { skills: ["Deception", "Stealth"], gear: "Crowbar, Dark Clothes", feature: "Criminal Contact" },
    "Folk Hero": { skills: ["Animal Handling", "Survival"], gear: "Shovel, Iron Pot", feature: "Rustic Hospitality" },
    "Sage": { skills: ["Arcana", "History"], gear: "Bottle of Ink, Quill", feature: "Researcher" },
    "Charlatan": { skills: ["Deception", "Sleight of Hand"], gear: "Fine Clothes, Disguise Kit", feature: "False Identity" }
};
export const ITEMS_DB: Item[] = [ 
    { id: 'pot_heal', name: "Healing Potion", type: "consumable", rarity: "common", value: 500, weight: 0.5, effect: { hp: 10 } }, 
    { id: 'ration', name: "Ration (Day)", type: "food", rarity: "common", value: 50, weight: 2, effect: { hunger: -1 } }, 
    { id: 'waterskin', name: "Waterskin (Full)", type: "water", rarity: "common", value: 20, weight: 5, effect: { thirst: -0.5 } }, 
    
    // Weapons
    { id: 'sword_iron', name: "Iron Longsword", type: "weapon", rarity: "common", slot: "mainHand", power: 3, weight: 3, value: 1000 }, 
    { id: 'axe_great', name: "Great Axe", type: "weapon", rarity: "uncommon", slot: "mainHand", twoHanded: true, power: 5, weight: 7, value: 1500 }, 
    { id: 'dagger_iron', name: "Dagger", type: "weapon", rarity: "common", slot: "mainHand", power: 2, weight: 1, value: 200 },
    { id: 'mace_iron', name: "Mace", type: "weapon", rarity: "common", slot: "mainHand", power: 3, weight: 4, value: 500 },
    { id: 'axe_iron', name: "Axe", type: "weapon", rarity: "common", slot: "mainHand", power: 3, weight: 2, value: 500 },
    { id: 'bow_short', name: "Bow", type: "weapon", rarity: "common", slot: "mainHand", twoHanded: true, power: 3, weight: 2, value: 2500 },
    { id: 'hammer_war', name: "Hammer", type: "weapon", rarity: "common", slot: "mainHand", power: 4, weight: 2, value: 1500 },
    { id: 'staff_wood', name: "Staff", type: "weapon", rarity: "common", slot: "mainHand", twoHanded: true, power: 2, weight: 4, value: 500 },
    { id: 'spear_wood', name: "Spear", type: "weapon", rarity: "common", slot: "mainHand", power: 3, weight: 3, value: 100 },
    { id: 'crossbow_light', name: "Crossbow", type: "weapon", rarity: "common", slot: "mainHand", twoHanded: true, power: 4, weight: 5, value: 2500 },
    { id: 'scimitar', name: "Scimitar", type: "weapon", rarity: "common", slot: "mainHand", power: 3, weight: 3, value: 2500 },
    
    // Armor
    { id: 'shield_wood', name: "Wooden Shield", type: "armor", rarity: "common", slot: "offHand", ac: 2, weight: 6, value: 500 }, 
    { id: 'helmet_iron', name: "Iron Helmet", type: "armor", rarity: "common", slot: "head", ac: 2, weight: 4, value: 750 },
    { id: 'armor_leather', name: "Leather Armor", type: "armor", rarity: "common", slot: "chest", ac: 11, weight: 10, value: 1500 },
    { id: 'armor_chain', name: "Chain Mail", type: "armor", rarity: "common", slot: "chest", ac: 16, weight: 55, value: 7500 },
    { id: 'armor_plate', name: "Plate Armor", type: "armor", rarity: "rare", slot: "chest", ac: 18, weight: 65, value: 150000 },
    { id: 'greaves_iron', name: "Iron Greaves", type: "armor", rarity: "common", slot: "legs", ac: 3, weight: 10, value: 1000 },
    { id: 'gauntlets_leather', name: "Leather Gauntlets", type: "armor", rarity: "common", slot: "hands", ac: 1, weight: 1, value: 250 },
    { id: 'boots_leather', name: "Leather Boots", type: "armor", rarity: "common", slot: "feet", ac: 1, weight: 2, value: 250 },
    { id: 'robes', name: "Robes", type: "armor", rarity: "common", slot: "chest", ac: 10, weight: 4, value: 200 },
    { id: 'armor_scale', name: "Scale Mail", type: "armor", rarity: "common", slot: "chest", ac: 14, weight: 45, value: 5000 },
    { id: 'armor_hide', name: "Hide Armor", type: "armor", rarity: "common", slot: "chest", ac: 12, weight: 12, value: 1000 },

    // Accessories
    { id: 'ring_prot', name: "Ring of Protection", type: "accessory", rarity: "rare", slot: "ring", ac: 1, weight: 0.1, value: 5000 },
    { id: 'amulet_health', name: "Amulet of Health", type: "accessory", rarity: "rare", slot: "amulet", weight: 0.2, value: 7500, statsBonus: { con: 2 } },
    
    // Tools & Misc (Not equippable, so no slot)
    { id: 'book_spell', name: "Book", type: "tool", rarity: "common", weight: 3, value: 2500 },
    { id: 'focus_arcane', name: "Arcane Focus", type: "tool", rarity: "common", weight: 1, value: 1000 },
    { id: 'pouch_component', name: "Component Pouch", type: "tool", rarity: "common", weight: 2, value: 2500 },
    { id: 'tools_thieves', name: "Thieves' Tools", type: "tool", rarity: "common", weight: 1, value: 2500 },
    { id: 'lute', name: "Lute", type: "tool", rarity: "common", weight: 2, value: 3500 },
];
export const SPELLS_DB: Spell[] = [ { id: 'firebolt', name: "Fire Bolt", cost: 2, damage: 8, school: "Evocation", target: "enemy" }, { id: 'heal', name: "Cure Wounds", cost: 5, heal: 12, school: "Evocation", target: "ally" }, { id: 'shield', name: "Shield", cost: 3, buff: "Shielded", duration: 2, school: "Abjuration", target: "self" } ];
export const FEATS_DB = [ { id: 'alert', name: "Alert", desc: "+5 Initiative, cannot be surprised.", req: "None" }, { id: 'tough', name: "Tough", desc: "+2 HP per level.", req: "None" } ];