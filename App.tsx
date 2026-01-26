
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithCustomToken, Auth, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { RefreshCw, Heart, Zap, Wind, Coins, Map, User, Backpack, Star, Menu, Shield } from 'lucide-react';

import { Player, World, LogEntry, Choice, Item, Enemy } from './types/worldState';
import { getFirebaseConfig } from './firebase';
import { formatCurrency, createCharacter, checkSurvival, calculatePlayerAC, calculateXpToNextLevel, handleLevelUp } from './systems';
import { callGeminiAPI, buildPrompt, generateSceneImage } from './api';
import { saveGame, subscribeToSave } from './persistence';
import { saveGameLocal, loadGameLocal, deleteSaveLocal, GameState, getAllSaveSlotSummaries } from './localPersistence';
import {
  Landing, CharacterCreator, GameView, CharacterSheet, InventoryScreen, SpellScreen, QuestScreen, JournalScreen, CodexScreen, MainMenu,
  FeatScreen, FactionScreen, PartyScreen, MapScreen, SettingsPage, Bar, NavBtn, EquipmentScreen, ShopScreen, CombatScreen, StartScreen
} from './components';
import { ITEMS_DB } from './registries';

export default function App() {
  const [view, setView] = useState<string>('landing'); // Default to landing, which will show StartScreen
  const [loading, setLoading] = useState<boolean>(true);
  const [processing, setProcessing] = useState<boolean>(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [db, setDb] = useState<Firestore | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [world, setWorld] = useState<World>({ day: 1, hour: 8, weather: "Clear", facts: [], eventLog: [] });
  const [log, setLog] = useState<LogEntry[]>([]);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [input, setInput] = useState<string>("");
  const [shop, setShop] = useState<{name: string, inventory: Item[]}|null>(null);
  const [enemy, setEnemy] = useState<Enemy | null>(null);
  const [sceneImage, setSceneImage] = useState<string | null>(null);
  const [currentSlotId, setCurrentSlotId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initialize Firebase and attempt to load last played game
  useEffect(() => {
    const init = async () => {
      try {
        const config = getFirebaseConfig();
        if (config) {
          const app: FirebaseApp = getApps().length === 0 ? initializeApp(config) : getApp();
          const auth: Auth = getAuth(app);
          const firestore: Firestore = getFirestore(app);
          setDb(firestore);
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(auth, __initial_auth_token);
          else await signInAnonymously(auth);
          onAuthStateChanged(auth, (u: FirebaseUser | null) => { setUser(u); setLoading(false); });
        } else { setLoading(false); }
      } catch (e) { setLoading(false); console.error("Firebase init failed:", e); }
    };
    init();
  }, []);

  // Attempt to load game from last played slot
  useEffect(() => {
    if (!loading) { // Only run after Firebase init is complete
      const lastPlayedSlot = localStorage.getItem('lastPlayedSlotId');
      if (lastPlayedSlot) {
        handleLoadGame(lastPlayedSlot);
      } else {
        setView('startScreen');
      }
    }
  }, [loading]); // Depend on loading state

  // FIX: Changed `scrollRefRef` to `scrollRef`
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [log, processing]);

  const updateGameState = (newGameState: GameState) => {
    setPlayer(newGameState.player);
    setWorld(newGameState.world);
    setLog(newGameState.log);
    setChoices(newGameState.choices);
    setView(newGameState.view);
    setEnemy(newGameState.enemy);
    setSceneImage(newGameState.sceneImage);
  };

  const handleLoadGame = (slotId: string) => {
    const loadedState = loadGameLocal(slotId);
    if (loadedState && loadedState.player) { // Ensure player exists in loaded state
      updateGameState(loadedState);
      setCurrentSlotId(slotId);
      localStorage.setItem('lastPlayedSlotId', slotId);
      setView('game');
    } else {
      console.log(`No save data found for slot ${slotId}, starting new game flow.`);
      setCurrentSlotId(slotId); // Select this slot for new game
      setView('creator');
    }
  };

  const handleNewGameStart = (slotId: string) => {
    deleteSaveLocal(slotId); // Clear any existing data for this slot
    setCurrentSlotId(slotId);
    localStorage.setItem('lastPlayedSlotId', slotId);
    setPlayer(null); // Reset player to trigger character creation
    setWorld({ day: 1, hour: 8, weather: "Clear", facts: [], eventLog: [] });
    setLog([]);
    setChoices([]);
    setEnemy(null);
    setSceneImage(null);
    setView('creator');
  };

  const executeTurn = async (actionText: string, choice?: Choice) => {
    if (choice?.intent === 'system') {
        if (choice.id === 'settings') {
            setView('settings');
        }
        return;
    }

    if (processing || !actionText.trim() || !player || !currentSlotId) return; // Ensure currentSlotId is set
    setProcessing(true); setInput("");
    
    const currentLogType = enemy ? 'combat' : 'player';
    const nextLog = [...log, { type: currentLogType as any, text: actionText }];
    setLog(nextLog);

    const prompt = buildPrompt(player, world, actionText, enemy);
    try {
      const aiData = await callGeminiAPI(prompt);
      let nextPlayer = { ...player, quests: [...(player.quests || [])] };
      let nextEnemy = enemy ? {...enemy} : null;
      const nextWorld = { ...world };
      const p = aiData.patch || {};
      let finalLog = [...nextLog];
      let nextView = view;
      let nextSceneImage = sceneImage;
      
      if (p.scenePrompt) {
        const newSceneImage = await generateSceneImage(p.scenePrompt);
        if (newSceneImage) nextSceneImage = newSceneImage;
      }

      if (!enemy) { // Only advance time outside of combat
        nextWorld.hour += (p.timeDelta || 1);
        if (nextWorld.hour >= 24) { 
          nextWorld.hour %= 24; 
          nextWorld.day += 1; 
          const survivalResult = checkSurvival(nextPlayer);
          nextPlayer = survivalResult.player;
          if (survivalResult.messages.length) aiData.narration += " " + survivalResult.messages.join(" ");
        }
      }
      
      const currencyDelta = Math.floor(p.currencyDelta || 0);
      if (currencyDelta < 0 && (nextPlayer.currency + currencyDelta < 0)) { 
          aiData.narration += " (You cannot afford this.)"; 
      } else { 
          nextPlayer.currency = Math.max(0, nextPlayer.currency + currencyDelta); 
          if (p.addItemId) {
            const itemToAdd = ITEMS_DB.find(i => i.id === p.addItemId);
            if (itemToAdd) {
              nextPlayer.inventory = [...nextPlayer.inventory, { ...itemToAdd }];
            } else {
              console.warn(`AI returned invalid addItemId: ${p.addItemId}`);
              aiData.narration += ` (The item seems to have vanished.)`;
            }
          }
      }
      
      nextPlayer.hpCurrent = Math.min(nextPlayer.hpMax, Math.max(0, nextPlayer.hpCurrent + (p.hpDelta || 0)));
      if(nextEnemy && p.enemyHpDelta) {
        nextEnemy.hp = Math.max(0, nextEnemy.hp + p.enemyHpDelta);
      }
      
      nextPlayer.manaCurrent = Math.min(nextPlayer.manaMax, Math.max(0, nextPlayer.manaCurrent + (p.mpDelta || 0)));
      if (p.addFact) nextWorld.facts = [...nextWorld.facts, p.addFact];

      if (p.xpDelta > 0) {
        nextPlayer.xp += p.xpDelta;
      }

      if (p.addQuest && p.addQuest.title) {
        nextPlayer.quests.push({ ...p.addQuest, status: 'active' });
      }
      if (p.updateQuestStatus && p.updateQuestStatus.title) {
        const quest = nextPlayer.quests.find(q => q.title === p.updateQuestStatus.title);
        if (quest) quest.status = p.updateQuestStatus.newStatus;
      }
      if (p.removeQuest) {
        nextPlayer.quests = nextPlayer.quests.filter(q => q.title !== p.removeQuest);
      }

      if (p.shop && p.shop.name && p.shop.inventory) {
        const shopItems = p.shop.inventory
            .map((id: string) => ITEMS_DB.find(i => i.id === id))
            .filter((i): i is Item => i !== undefined);
        setShop({ name: p.shop.name, inventory: shopItems });
        setView('shop');
        nextView = 'shop';
      }

      let finalEnemy = nextEnemy;
      if (p.startCombat) {
        const newEnemy = { ...p.startCombat, hpMax: p.startCombat.hp };
        setEnemy(newEnemy);
        finalEnemy = newEnemy;
        setView('combat');
        nextView = 'combat';
      } else if (p.endCombat) {
        setEnemy(null);
        finalEnemy = null;
        setView('game');
        nextView = 'game';
      } else {
        setEnemy(nextEnemy);
      }

      const xpToNextLevel = calculateXpToNextLevel(nextPlayer.level);
      if (nextPlayer.xp >= xpToNextLevel) {
          nextPlayer.xp -= xpToNextLevel;
          const levelUpResult = handleLevelUp(nextPlayer);
          nextPlayer = levelUpResult.player;
          levelUpResult.messages.forEach(msg => {
              finalLog.push({ type: 'levelup', text: msg });
          });
      }

      if (p.clearInventory || p.clearEquipment) {
        if (nextPlayer.inventory.length > 0) nextPlayer.confiscatedInventory = [...nextPlayer.inventory];
        if (Object.keys(nextPlayer.equipment).length > 0) nextPlayer.confiscatedEquipment = {...nextPlayer.equipment};
        nextPlayer.inventory = [];
        nextPlayer.equipment = {};
        nextPlayer.ac = calculatePlayerAC(nextPlayer);
      } else if (p.restoreInventory) {
        if (nextPlayer.confiscatedInventory && nextPlayer.confiscatedInventory.length > 0) {
          nextPlayer.inventory.push(...nextPlayer.confiscatedInventory);
          delete nextPlayer.confiscatedInventory;
        }
        if (nextPlayer.confiscatedEquipment) {
          nextPlayer.equipment = nextPlayer.confiscatedEquipment;
          delete nextPlayer.confiscatedEquipment;
        }
        nextPlayer.ac = calculatePlayerAC(nextPlayer);
      }
      
      finalLog.push({ type: 'narration' as const, text: aiData.narration });
      const finalChoices = aiData.choices || [];
      setPlayer(nextPlayer); 
      setWorld(nextWorld); 
      setLog(finalLog); 
      setChoices(finalChoices);
      setSceneImage(nextSceneImage);
      
      saveGameLocal(currentSlotId, { player: nextPlayer, world: nextWorld, log: finalLog, choices: finalChoices, view: nextView, enemy: finalEnemy, sceneImage: nextSceneImage });
      if (user && db) {
        saveGame(db, user, nextPlayer, nextWorld, finalLog, finalChoices, nextView, finalEnemy, nextSceneImage);
      }
    } catch (err) {
      console.error(err);
      
      let errorMessage = "The mists obscure your vision. Try a different approach.";
      let errorChoices: Choice[] = [{ id: 'retry', label: 'Retry Last Action', intent: 'rest' }];
      const errorText = err instanceof Error ? err.message.toLowerCase() : "";

      if (errorText.includes("api key")) {
        errorMessage = "A connection to the arcane energies could not be established. The realm's configuration seems to be missing.";
        errorChoices = [{ id: 'settings', label: 'Check Settings', intent: 'system' }];
      } else if (errorText.includes("quota") || errorText.includes("resource_exhausted")) {
        errorMessage = "Your connection to the arcane energies has been temporarily suspended due to overuse. Please check your Gemini API plan and billing details, or try again later.";
        errorChoices = [{ id: 'settings', label: 'Check API Settings', intent: 'system' }];
      } else if (errorText.includes("json") || errorText.includes("unexpected token")) {
        errorMessage = "The world's response was garbled and indistinct, like a whisper on the wind. Perhaps we should try again.";
      } else if (errorText.includes("network") || errorText.includes("failed to fetch")) {
        errorMessage = "The connection to the ethereal plane is unstable. Please check your connection to the physical world.";
      } else if (err instanceof Error) {
          errorMessage = `The world shudders with an unknown force. (${err.message})`;
      }

      setLog(prev => [...prev, { type: 'error', text: errorMessage }]);
      setChoices(errorChoices);
    }
    setProcessing(false);
  };

  const handleCharacterCreation = (playerData: Player) => {
    if (!currentSlotId) {
      console.error("No slot selected for character creation.");
      setView('startScreen');
      return;
    }
    const { player, world, log, choices } = createCharacter(playerData);
    setPlayer(player); setWorld(world); setLog(log); setChoices(choices); setView('game');
    const gameState = { player, world, log, choices, view: 'game', enemy: null, sceneImage: null };
    saveGameLocal(currentSlotId, gameState);
    if (user && db) {
      saveGame(db, user, player, world, log, choices, 'game', null, null);
    }
  };

  const handleSaveGame = () => {
    if (!player || !currentSlotId) return;
    saveGameLocal(currentSlotId, { player, world, log, choices, view, enemy, sceneImage });
  };

  const handleNewGame = () => { // Directs to start screen for slot selection
    setView('startScreen');
    setCurrentSlotId(null); // Clear current slot
    setPlayer(null); // Clear player to force new character creation flow
  };

  const handleEquip = (itemToEquip: Item) => {
    if (!player || !currentSlotId) return;
    const nextPlayer = JSON.parse(JSON.stringify(player));
    const itemIndex = nextPlayer.inventory.findIndex((i: Item) => i.name === itemToEquip.name && i.id === itemToEquip.id);
    if (itemIndex === -1) return;
    const [item] = nextPlayer.inventory.splice(itemIndex, 1);
    let targetSlot = item.slot;
    if (targetSlot === 'ring') {
        if (!nextPlayer.equipment.ring1) targetSlot = 'ring1';
        else if (!nextPlayer.equipment.ring2) targetSlot = 'ring2';
        else targetSlot = 'ring1';
    }
    const currentlyEquipped = nextPlayer.equipment[targetSlot];
    if (currentlyEquipped) {
      nextPlayer.inventory.push(currentlyEquipped);
    }
    if (item.twoHanded) {
      const offHandItem = nextPlayer.equipment.offHand;
      if (offHandItem) {
        nextPlayer.inventory.push(offHandItem);
        delete nextPlayer.equipment.offHand;
      }
    }
    if (targetSlot === 'offHand' && nextPlayer.equipment.mainHand?.twoHanded) {
      nextPlayer.inventory.push(item);
      setPlayer(nextPlayer);
      return;
    }
    nextPlayer.equipment[targetSlot] = item;
    nextPlayer.ac = calculatePlayerAC(nextPlayer);
    setPlayer(nextPlayer);
    saveGameLocal(currentSlotId, { player: nextPlayer, world, log, choices, view: 'equipment', enemy, sceneImage });
  };

  const handleUnequip = (slot: string) => {
    if (!player || !currentSlotId) return;
    const itemToUnequip = player.equipment[slot];
    if (!itemToUnequip) return;
    const nextPlayer = JSON.parse(JSON.stringify(player));
    delete nextPlayer.equipment[slot];
    nextPlayer.inventory.push(itemToUnequip);
    nextPlayer.ac = calculatePlayerAC(nextPlayer);
    setPlayer(nextPlayer);
    saveGameLocal(currentSlotId, { player: nextPlayer, world, log, choices, view: 'equipment', enemy, sceneImage });
  };
  
  const handleCastSpell = (spellName: string) => {
      setInput(`Cast ${spellName}`);
      setView('game');
  };

  const handleBuy = (itemToBuy: Item) => {
      if (!player || !shop || !currentSlotId) return;
      const cost = itemToBuy.value || 0;
      if (player.currency < cost) return;

      const nextPlayer = { ...player };
      nextPlayer.currency -= cost;
      nextPlayer.inventory = [...nextPlayer.inventory, itemToBuy];

      const nextShop = { ...shop };
      nextShop.inventory = nextShop.inventory.filter(i => !(i.id === itemToBuy.id && i.name === itemToBuy.name));
      
      setPlayer(nextPlayer);
      setShop(nextShop);
      saveGameLocal(currentSlotId, { player: nextPlayer, world, log, choices, view: 'shop', enemy, sceneImage });
  };

  const handleSell = (itemToSell: Item, index: number) => {
      if (!player || !shop || !currentSlotId) return;
      const saleValue = Math.floor((itemToSell.value || 0) / 2);

      const nextPlayer = { ...player };
      nextPlayer.currency += saleValue;
      const newInventory = [...nextPlayer.inventory];
      newInventory.splice(index, 1);
      nextPlayer.inventory = newInventory;
      
      const nextShop = { ...shop };
      nextShop.inventory = [...nextShop.inventory, itemToSell];

      setPlayer(nextPlayer);
      setShop(nextShop);
      saveGameLocal(currentSlotId, { player: nextPlayer, world, log, choices, view: 'shop', enemy, sceneImage });
  };

  if (loading) return <div className="h-screen bg-slate-950 flex items-center justify-center text-indigo-500"><RefreshCw className="animate-spin"/></div>;
  
  // Show StartScreen if no player is loaded and we are not in character creator
  if (view === 'startScreen') return <StartScreen onLoadGame={handleLoadGame} onNewGameStart={handleNewGameStart} />;
  
  // Character creator is displayed when player is null and a slot is selected
  if (view === 'creator' && currentSlotId && !player) return <CharacterCreator onComplete={handleCharacterCreation} onBack={() => setView('startScreen')} />;
  
  // Fallback if player somehow becomes null without a valid flow
  if (!player && view !== 'startScreen' && view !== 'creator') return <StartScreen onLoadGame={handleLoadGame} onNewGameStart={handleNewGameStart} />;


  const mainView = () => {
    if (!player) return null; // Should not happen with the above logic, but for type safety
    if (view === 'combat' && enemy) return <CombatScreen player={player} enemy={enemy} onAction={executeTurn} log={log} scrollRef={scrollRef} processing={processing} sceneImage={sceneImage} />;
    if (view === 'game') return <GameView log={log} choices={choices} processing={processing} input={input} setInput={setInput} onAction={executeTurn} scrollRef={scrollRef} sceneImage={sceneImage} />;
    if (view === 'sheet') return <CharacterSheet player={player} onClose={() => setView('game')} />;
    if (view === 'inventory') return <InventoryScreen player={player} onClose={() => setView('game')} />;
    if (view === 'equipment') return <EquipmentScreen player={player} onClose={() => setView('game')} onEquip={handleEquip} onUnequip={handleUnequip} />;
    if (view === 'spells') return <SpellScreen player={player} onClose={() => setView('game')} onCast={handleCastSpell} />;
    if (view === 'quests') return <QuestScreen player={player} onClose={() => setView('game')} />;
    if (view === 'journal') return <JournalScreen log={log} world={world} onClose={() => setView('game')} />;
    if (view === 'codex') return <CodexScreen world={world} player={player} onClose={() => setView('game')} />;
    if (view === 'menu') return <MainMenu setView={setView} onClose={() => setView('game')} onSaveGame={handleSaveGame} onNewGame={handleNewGame} />;
    if (view === 'feats') return <FeatScreen player={player} onClose={() => setView('game')} />;
    if (view === 'factions') return <FactionScreen player={player} onClose={() => setView('game')} />;
    if (view === 'party') return <PartyScreen player={player} onClose={() => setView('game')} />;
    if (view === 'map') return <MapScreen world={world} onClose={() => setView('game')} />;
    if (view === 'settings') return <SettingsPage onClose={() => setView('game')} />;
    if (view === 'shop' && shop) return <ShopScreen player={player} shop={shop} onClose={() => { setView('game'); setShop(null); saveGameLocal(currentSlotId!, { player, world, log, choices, view: 'game', enemy, sceneImage }); }} onBuy={handleBuy} onSell={handleSell} />;
    return <GameView log={log} choices={choices} processing={processing} input={input} setInput={setInput} onAction={executeTurn} scrollRef={scrollRef} sceneImage={sceneImage} />;
  }

  return (
    <div className="h-screen bg-slate-950 text-slate-200 flex flex-col max-w-md mx-auto shadow-2xl overflow-hidden font-sans">
      <div className="bg-slate-900 border-b border-slate-800 p-3 flex flex-col gap-2 shrink-0 z-10">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center border border-indigo-400 text-white font-bold shadow-lg">{player?.level || 1}</div>
            <div><div className="font-bold text-white text-sm">{player?.name || "Hero"}</div><div className="text-[10px] text-slate-400 uppercase tracking-wider">{player?.race || "Unknown"} {player?.class || "Adventurer"}</div></div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-cyan-400 font-mono text-xs"><Shield size={12} /> {player?.ac || 10} AC</div>
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1 text-amber-400 font-mono text-xs mb-1"><Coins size={12} /> {formatCurrency(player?.currency || 0)}</div>
              <div className="text-[10px] text-slate-500 flex gap-2"><span>Day {world.day}</span><span>{world.hour}:00</span></div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Bar color="bg-red-500" cur={player?.hpCurrent || 0} max={player?.hpMax || 1} label="HP" icon={<Heart size={8}/>} />
          <Bar color="bg-blue-500" cur={player?.manaCurrent || 0} max={player?.manaMax || 1} label="MP" icon={<Zap size={8}/>} />
          <Bar color="bg-green-500" cur={player?.staminaCurrent || 0} max={player?.staminaMax || 1} label="ST" icon={<Wind size={8}/>} />
        </div>
        <Bar color="bg-amber-500" cur={player?.xp || 0} max={calculateXpToNextLevel(player?.level || 1)} label="XP" icon={<Star size={8} />} />
      </div>
      <div className="flex-1 overflow-hidden relative">
        {mainView()}
      </div>
      <nav className="bg-slate-900 border-t border-slate-800 p-2 grid grid-cols-5 gap-1 shrink-0">
        <NavBtn icon={<Map size={20}/>} label="World" active={view==='game'} onClick={() => setView('game')} />
        <NavBtn icon={<User size={20}/>} label="Hero" active={view==='sheet'} onClick={() => setView('sheet')} />
        <NavBtn icon={<Backpack size={20}/>} label="Bag" active={view==='inventory'} onClick={() => setView('inventory')} />
        <NavBtn icon={<Shield size={20}/>} label="Gear" active={view==='equipment'} onClick={() => setView('equipment')} />
        <NavBtn icon={<Menu size={20}/>} label="Menu" active={view==='menu'} onClick={() => setView('menu')} />
      </nav>
    </div>
  );
}