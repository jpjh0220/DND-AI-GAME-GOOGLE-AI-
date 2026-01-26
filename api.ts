import { GoogleGenAI, Modality } from "@google/genai";
import { Player, World, Enemy } from './types/worldState';
import { calculateEncumbrance, calculateMaxCarry } from './systems';
import { ITEMS_DB } from './registries';

const MODEL_TEXT = "gemini-3-flash-preview";
const MODEL_IMAGE = "gemini-2.5-flash-image";
const MODEL_TTS = "gemini-2.5-flash-preview-tts";

export const buildPrompt = (player: Player, world: World, actionText: string, enemy?: Enemy | null): string => {
    const purchasableItems = ITEMS_DB.map(i => `${i.name} (id: ${i.id}, value: ${i.value || 0})`).join('; ');
    const activeQuests = player.quests?.filter(q => q.status === 'active').map(q => q.title).join(', ') || 'None';

    let prompt = `Role: D&D 5E DM. Output JSON ONLY.
      World: Day ${world.day}, ${world.hour}:00. Weather: ${world.weather}.
      Player: ${player.name} (${player.race} ${player.class}, Lvl ${player.level}).
      HP: ${player.hpCurrent}/${player.hpMax}. MP: ${player.manaCurrent}/${player.manaMax}. AC: ${player.ac}. Exhaustion: ${player.exhaustion || 0}.
      Active Quests: ${activeQuests}.
      Survival: Hunger ${player.hungerDays} days, Thirst ${player.thirstDays} days.
      Encumbrance: ${calculateEncumbrance(player.inventory)}/${calculateMaxCarry(player.stats?.str)} lbs.
      Currency: ${player.currency} copper.
      Inventory: ${player.inventory.map(i => i.name).join(", ")}.
      Spells: ${player.spells.map(s => `${s.name} (${s.cost}MP)`).join(', ') || 'None'}.
      Facts: ${(world?.facts || []).join(", ")}.
      Confiscated Items: ${player.confiscatedInventory && player.confiscatedInventory.length > 0 ? 'Yes' : 'No'}.
      Available Items for purchase/loot: ${purchasableItems}.
      Action: "${actionText}"
      `;

    if (enemy) {
        prompt += `
      COMBAT SCENE:
      Enemy: ${enemy.name}. HP: ${enemy.hp}/${enemy.hpMax}. AC: ${enemy.ac}. Damage: ${enemy.damage}.
      Combat Instructions:
      1. This is the player's turn. Narrate the result of the player's action.
      2. Calculate if the player's attack hits the enemy's AC.
      3. If it hits, determine damage and return it as a negative 'enemyHpDelta'.
      4. After the player's action, narrate the enemy's turn and its attack against the player.
      5. If the enemy attack hits the player's AC, calculate damage and return it as a negative 'hpDelta'.
      6. If the enemy is defeated (HP <= 0), set 'endCombat' to true, and grant rewards (xpDelta, currencyDelta, addItemId).
      7. If the player is defeated (HP <= 0), set 'endCombat' to true and narrate the dire consequences.
      JSON Schema: { 
        "narration": "string", 
        "choices": [], 
        "patch": { 
            "hpDelta": 0, "enemyHpDelta": 0, "xpDelta": 0, "endCombat": false,
            "scenePrompt": "A cinematic high-detail fantasy concept art of ${enemy.name} in combat at the current location, atmospheric lighting, 16:9"
        } 
      }`;
    } else {
        prompt += `
      Instructions:
      1. If buying items, check if player has enough Currency. If not, reject.
      2. If buying, return negative 'currencyDelta'. Use the item's value.
      3. If an item is added to inventory, use 'addItemId'.
      4. To start a combat encounter, provide a 'startCombat' object with the enemy's details.
      5. Quests: To add a quest, use 'addQuest: {title, description}'. To complete, use 'updateQuestStatus: {title, newStatus: "completed"}'.
      6. Shops: To open a shop, provide a 'shop' object with a 'name' and an 'inventory' array of item IDs.
      7. If the scene or location changes significantly, provide a 'scenePrompt'.
      JSON Schema: { 
        "narration": "string", 
        "choices": [{ "id": "str", "label": "str", "intent": "travel|combat|social|buy|rest|system" }], 
        "patch": { 
            "timeDelta": 1, "currencyDelta": 0, "hpDelta": 0, "addItemId": "string", "addFact": "string", "xpDelta": 0, "addQuest": {"title": "string", "description": "string"}, "updateQuestStatus": {"title": "string", "newStatus": "completed"}, 
            "scenePrompt": "A high-detail 16:9 environmental concept art of the current location in a fantasy world, cinematic lighting, professional digital painting style",
            "startCombat": {"name": "string", "hp": "number", "ac": "number", "damage": "string"}
        } 
      }`;
    }
    
    return prompt;
}

export const generateSceneImage = async (prompt: string): Promise<string | null> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const response = await ai.models.generateContent({
            model: MODEL_IMAGE,
            contents: { parts: [{ text: prompt }] },
            config: { imageConfig: { aspectRatio: "16:9" } }
        });
        const part = response.candidates[0].content.parts.find(p => p.inlineData);
        return part ? `data:image/png;base64,${part.inlineData.data}` : null;
    } catch (err) {
        console.error("Image Gen Error:", err);
        return null;
    }
};

export const generateSpeech = async (text: string): Promise<string | null> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const response = await ai.models.generateContent({
            model: MODEL_TTS,
            contents: [{ parts: [{ text: `Dungeon Master voice: ${text}` }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
            },
        });
        return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    } catch (err) {
        console.error("TTS Error:", err);
        return null;
    }
};

export const callGeminiAPI = async (userQuery: string): Promise<any> => {
    if (!process.env.API_KEY) {
        console.error("API key not found in process.env.API_KEY");
        throw new Error("API key not found.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    let rawText: string | undefined = '';
    try {
        const response = await ai.models.generateContent({ model: MODEL_TEXT, contents: userQuery });
        rawText = response.text;
        if (!rawText) throw new Error("No response text from Gemini.");
        // Relaxed JSON parsing: find the first '{' and the last '}'
        const firstBrace = rawText.indexOf('{');
        const lastBrace = rawText.lastIndexOf('}');
        if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
            throw new Error("Valid JSON object not found in the response.");
        }
        const parsableText = rawText.substring(firstBrace, lastBrace + 1);
        return JSON.parse(parsableText);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        throw new Error(`Gemini Error: ${errorMessage}. Raw Response: ${rawText}`);
    }
};