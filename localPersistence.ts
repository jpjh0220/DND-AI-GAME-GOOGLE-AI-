import { Player, World, LogEntry, Choice, Enemy } from './types/worldState';

const SAVE_KEY_PREFIX = 'mythicRealmsSaveData_';

export interface GameState {
  player: Player | null;
  world: World;
  log: LogEntry[];
  choices: Choice[];
  view: string;
  enemy: Enemy | null;
  sceneImage: string | null;
}

export interface SaveSlotSummary {
  slotId: string;
  exists: boolean;
  playerName?: string;
  playerLevel?: number;
  worldDay?: number;
}

export const saveGameLocal = (slotId: string, gameState: GameState): void => {
  try {
    const stateString = JSON.stringify(gameState);
    localStorage.setItem(`${SAVE_KEY_PREFIX}${slotId}`, stateString);
    console.log(`Game saved to localStorage slot: ${slotId}`);
  } catch (error) {
    console.error(`Failed to save game to localStorage slot ${slotId}:`, error);
  }
};

export const loadGameLocal = (slotId: string): GameState | null => {
  try {
    const savedStateString = localStorage.getItem(`${SAVE_KEY_PREFIX}${slotId}`);
    if (savedStateString === null) {
      return null;
    }
    console.log(`Game loaded from localStorage slot: ${slotId}`);
    return JSON.parse(savedStateString);
  } catch (error) {
    console.error(`Failed to load game from localStorage slot ${slotId}:`, error);
    return null;
  }
};

export const deleteSaveLocal = (slotId: string): void => {
  try {
    localStorage.removeItem(`${SAVE_KEY_PREFIX}${slotId}`);
    console.log(`Local save deleted for slot: ${slotId}`);
  } catch (error) {
    console.error(`Failed to delete local save for slot ${slotId}:`, error);
  }
};

export const getAllSaveSlotSummaries = async (numSlots: number): Promise<SaveSlotSummary[]> => {
  const summaries: SaveSlotSummary[] = [];
  for (let i = 1; i <= numSlots; i++) {
    const slotId = `slot${i}`;
    const savedStateString = localStorage.getItem(`${SAVE_KEY_PREFIX}${slotId}`);
    if (savedStateString) {
      try {
        const gameState: GameState = JSON.parse(savedStateString);
        summaries.push({
          slotId: slotId,
          exists: true,
          playerName: gameState.player?.name || 'Unknown Hero',
          playerLevel: gameState.player?.level || 1,
          worldDay: gameState.world?.day || 1,
        });
      } catch (error) {
        console.error(`Error parsing save data for slot ${slotId}:`, error);
        summaries.push({ slotId: slotId, exists: false });
      }
    } else {
      summaries.push({ slotId: slotId, exists: false });
    }
  }
  return summaries;
};