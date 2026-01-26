import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Heart, Zap, Wind, X, Send, Search, AlertTriangle, Flame, ChevronRight, Shield, Coins, Swords, Volume2, Play, RefreshCw, Save
} from 'lucide-react';
import { Player, World, LogEntry, Choice, Spell, Quest, Item, Enemy } from './types/worldState';
import { RACES, CLASSES, FEATS_DB, BACKGROUNDS } from './registries';
import { getMod, getSpellcastingAbility, ALL_SKILLS, assignDefaultStats, calculateXpToNextLevel, formatCurrency } from './systems';
import { generateSpeech } from './api';
import { getAllSaveSlotSummaries, deleteSaveLocal, SaveSlotSummary } from './localPersistence';

// --- UTILS ---
const decodeBase64 = (base64: string) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
};

const decodeAudioData = async (bytes: Uint8Array, ctx: AudioContext) => {
    const dataInt16 = new Int16Array(bytes.buffer);
    const frameCount = dataInt16.length;
    const buffer = ctx.createBuffer(1, frameCount, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i] / 32768.0;
    return buffer;
};

// --- SUB-COMPONENTS ---

const AudioPlayer: React.FC<{ text: string }> = ({ text }) => {
    const [loading, setLoading] = useState(false);
    const [playing, setPlaying] = useState(false);
    
    const playAudio = async () => {
        if (playing) return;
        setLoading(true);
        const base64 = await generateSpeech(text);
        if (base64) {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            const bytes = decodeBase64(base64);
            const buffer = await decodeAudioData(bytes, ctx);
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);
            source.onended = () => setPlaying(false);
            source.start();
            setPlaying(true);
        }
        setLoading(false);
    };

    return (
        <button onClick={playAudio} className={`p-1.5 rounded-full transition-all shrink-0 ${playing ? 'bg-indigo-500 text-white animate-pulse' : 'text-slate-500 hover:text-indigo-400'}`}>
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Volume2 size={14} />}
        </button>
    );
};

interface GameViewProps { log: LogEntry[]; choices: Choice[]; processing: boolean; input: string; setInput: React.Dispatch<React.SetStateAction<string>>; onAction: (actionText: string, choice?: Choice) => Promise<void>; scrollRef: React.RefObject<HTMLDivElement>; sceneImage?: string | null; }
export const GameView: React.FC<GameViewProps> = ({ log, choices, processing, input, setInput, onAction, scrollRef, sceneImage }) => (
  <div className="absolute inset-0 flex flex-col bg-slate-950 overflow-hidden">
    {sceneImage && (
      <div className="w-full aspect-video relative shrink-0 overflow-hidden border-b border-slate-800 animate-in fade-in duration-1000">
        <img src={sceneImage} alt="Scene" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60"></div>
        <div className="absolute inset-0 bg-indigo-900/10 mix-blend-overlay"></div>
      </div>
    )}
    <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth" ref={scrollRef}>
      {log.map((msg, i) => (
        <div key={i} className={`flex ${msg.type === 'player' ? 'justify-end' : 'justify-start'} animate-slide-in-from-bottom`}>
          <div className={`group relative max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed shadow-md flex gap-2 items-start ${msg.type === 'player' ? 'bg-indigo-600 text-white rounded-tr-none' : msg.type === 'error' ? 'bg-red-900 border border-red-700 rounded-tl-none text-red-200' : 'bg-slate-800 border border-slate-700 rounded-tl-none text-slate-300'}`}>
            <span className="flex-1">{msg.text}</span>
            {msg.type === 'narration' && <AudioPlayer text={msg.text} />}
          </div>
        </div>
      ))}
      {processing && <div className="text-xs text-slate-500 italic p-2 animate-pulse">The mists of destiny are shifting...</div>}
    </div>
    <div className="bg-slate-900 border-t border-slate-800 p-3 pb-safe shrink-0">
      <div className="flex gap-2 mb-3 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {choices.map((c, i) => (<button key={i} disabled={processing} onClick={() => { console.log(`[DEBUG] Choice clicked: ${c.label}`); onAction(c.label, c); }} className="whitespace-nowrap px-4 py-2 bg-slate-800 border border-slate-700 hover:border-indigo-500 rounded-xl text-xs font-bold transition-all disabled:opacity-50">{c.label}</button>))}
      </div>
      <div className="flex gap-2">
        <input className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none" placeholder="Action..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && onAction(input)} disabled={processing}/>
        <button onClick={() => { console.log(`[DEBUG] Send button clicked with input: "${input}"`); onAction(input); }} disabled={processing||!input.trim()} className="p-3 bg-indigo-600 rounded-xl text-white disabled:opacity-50"><Send size={18}/></button>
      </div>
    </div>
  </div>
);

interface CombatScreenProps { player: Player; enemy: Enemy; onAction: (actionText: string) => void; log: LogEntry[]; scrollRef: React.RefObject<HTMLDivElement>; processing: boolean; sceneImage?: string | null; }
export const CombatScreen: React.FC<CombatScreenProps> = ({ player, enemy, onAction, log, scrollRef, processing, sceneImage }) => {
    const weaponName = player.equipment.mainHand?.name || "unarmed strike";
    const topSpell = player.spells[0]?.name;

    return (
        <div className="absolute inset-0 flex flex-col bg-slate-950 overflow-hidden">
             {sceneImage && (
                <div className="w-full aspect-video relative shrink-0 border-b border-slate-800 overflow-hidden">
                    <img src={sceneImage} alt="Enemy" className="w-full h-full object-cover scale-110 blur-[1px] brightness-75" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <img src={sceneImage} alt="Focus" className="w-[90%] h-[90%] object-contain drop-shadow-[0_0_15px_rgba(0,0,0,0.8)]" />
                    </div>
                </div>
            )}
            <div className="p-4 bg-slate-900/90 backdrop-blur-sm border-b border-slate-800 z-10 shrink-0">
                <div className="text-center mb-2">
                    <h2 className="font-bold text-xl text-red-500 tracking-tight uppercase">{enemy.name}</h2>
                    <p className="text-[10px] text-slate-500 uppercase font-mono tracking-widest">Def: {enemy.ac} | Vitality: {enemy.hp}/{enemy.hpMax}</p>
                </div>
                <Bar color="bg-red-600" cur={enemy.hp} max={enemy.hpMax} label="Foeman Health" icon={<Heart size={8}/>} />
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth" ref={scrollRef}>
                {log.filter(l => ['combat', 'narration', 'player'].includes(l.type)).map((msg, i) => (
                    <div key={i} className={`flex ${msg.type === 'player' ? 'justify-end' : 'justify-start'} animate-slide-in-from-bottom`}>
                        <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed flex gap-2 items-start ${msg.type === 'player' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-800 border border-slate-700 rounded-tl-none text-slate-300'}`}>
                            <span className="flex-1">{msg.text}</span>
                            {msg.type === 'narration' && <AudioPlayer text={msg.text} />}
                        </div>
                    </div>
                ))}
            </div>
            <div className="bg-slate-900 border-t border-slate-800 p-3 pb-safe shrink-0">
                <div className="grid grid-cols-2 gap-2">
                    <button disabled={processing} onClick={() => onAction(`I strike ${enemy.name} with my ${weaponName}`)} className="p-4 bg-red-900/40 border border-red-500/30 hover:bg-red-800/60 rounded-xl font-bold flex flex-col items-center justify-center transition-all disabled:opacity-50">
                        <Swords size={20} className="mb-1 text-red-400"/>
                        <span className="text-[10px] text-white">Attack</span>
                        <span className="text-[8px] text-red-300/60 uppercase truncate w-full px-1">{weaponName}</span>
                    </button>
                    {topSpell ? (
                        <button disabled={processing} onClick={() => onAction(`I cast ${topSpell} upon ${enemy.name}`)} className="p-4 bg-blue-900/40 border border-blue-500/30 hover:bg-blue-800/60 rounded-xl font-bold flex flex-col items-center justify-center transition-all disabled:opacity-50">
                            <Zap size={20} className="mb-1 text-blue-400"/>
                            <span className="text-[10px] text-white">Cast</span>
                            <span className="text-[8px] text-blue-300/60 uppercase truncate w-full px-1">{topSpell}</span>
                        </button>
                    ) : (
                         <button disabled={processing} onClick={() => onAction("I assume a defensive stance")} className="p-4 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold flex flex-col items-center justify-center transition-all disabled:opacity-50 text-slate-400">
                            <Shield size={20} className="mb-1"/>
                            <span className="text-[10px]">Defend</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

interface ScreenProps { player: Player; onClose: () => void; }
interface WorldScreenProps { world: World; onClose: () => void; }

const SheetSection: React.FC<{ title: string; children: React.ReactNode; }> = ({ title, children }) => (
    <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
        <h3 className="text-xs font-bold text-indigo-400 uppercase mb-3 tracking-wider">{title}</h3>
        {children}
    </div>
);

export const CharacterSheet: React.FC<ScreenProps> = ({ player, onClose }) => {
    const proficiencyBonus = 2; // Hardcoded for Lvl 1-4
    const initiative = getMod(player.stats.dex);
    const speed = RACES[player.race]?.speed || 30;
    const spellcastingAbility = getSpellcastingAbility(player.class);
    const spellPower = getMod(player.stats[spellcastingAbility]);
    const weaponPower = Math.max(getMod(player.stats.str), getMod(player.stats.dex));
    const xpToNext = calculateXpToNextLevel(player.level);

    const renderSavingThrows = () => (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {Object.keys(player.stats).map(statKey => {
                const isProficient = player.proficiencies.savingThrows.includes(statKey);
                const modifier = getMod(player.stats[statKey]);
                const totalBonus = modifier + (isProficient ? proficiencyBonus : 0);
                return (
                    <div key={statKey} className="flex items-center gap-2 text-sm">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${isProficient ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-500'}`}>{isProficient ? '✔' : ''}</div>
                        <span className="uppercase font-bold text-slate-400 w-8">{statKey}</span>
                        <span className="font-mono">{totalBonus >= 0 ? `+${totalBonus}` : totalBonus}</span>
                    </div>
                );
            })}
        </div>
    );

    const renderSkills = () => (
        <div className="space-y-2">
            {Object.entries(ALL_SKILLS).map(([skillName, statKey]) => {
                const isProficient = player.proficiencies.skills.includes(skillName);
                const modifier = getMod(player.stats[statKey]);
                const totalBonus = modifier + (isProficient ? proficiencyBonus : 0);
                return (
                    <div key={skillName} className="flex items-center text-sm border-b border-slate-800/50 pb-2">
                         <div className={`w-4 h-4 rounded-full flex items-center justify-center mr-2 text-[10px] ${isProficient ? 'bg-indigo-500' : 'bg-slate-800'}`}></div>
                        <span className="flex-1">{skillName} <span className="text-slate-500 text-xs">({statKey.toUpperCase()})</span></span>
                        <span className="font-mono">{totalBonus >= 0 ? `+${totalBonus}` : totalBonus}</span>
                    </div>
                )
            })}
        </div>
    );
    
    return (
        <div className="absolute inset-0 bg-slate-950 flex flex-col z-20 animate-slide-in-from-bottom">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 sticky top-0">
                <h2 className="font-bold text-white">Character Sheet</h2>
                <button onClick={onClose}><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <SheetSection title="Identity">
                    <h1 className="text-2xl font-bold text-white">{player.name}</h1>
                    <p className="text-slate-400 text-sm">{player.race} {player.class} {player.level}</p>
                    <div className="mt-2">
                        <div className="flex justify-between text-xs text-slate-400 mb-1">
                            <span>Experience</span>
                            <span className="font-mono">{player.xp} / {xpToNext}</span>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-amber-500 transition-all" style={{width: `${(player.xp/xpToNext)*100}%`}}></div></div>
                    </div>
                    <p className="text-slate-500 text-xs mt-2">{player.background}</p>
                    <p className="italic text-indigo-200/80 mt-3 text-sm bg-indigo-900/20 p-3 rounded-lg">"{player.concept}"</p>
                </SheetSection>
                
                <div className="grid grid-cols-3 gap-2">{Object.entries(player.stats).map(([k,v]) => (<div key={k} className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-center"><div className="text-[10px] uppercase text-slate-500">{k}</div><div className="text-xl font-bold">{v}</div><div className="text-xs text-indigo-400 font-mono">{getMod(v as number) >= 0 ? `+${getMod(v as number)}` : getMod(v as number)}</div></div>))}</div>

                <SheetSection title="Combat & Derived Stats">
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div><div className="text-2xl font-bold text-cyan-400">{player.ac}</div><div className="text-xs text-slate-500">Armor Class</div></div>
                        <div><div className="text-2xl font-bold text-amber-400">{initiative >= 0 ? `+${initiative}`: initiative}</div><div className="text-xs text-slate-500">Initiative</div></div>
                        <div><div className="text-2xl font-bold text-emerald-400">{speed}ft</div><div className="text-xs text-slate-500">Speed</div></div>
                        <div><div className="text-2xl font-bold text-slate-300">+{proficiencyBonus}</div><div className="text-xs text-slate-500">Proficiency</div></div>
                        <div><div className="text-2xl font-bold text-rose-400">{weaponPower >= 0 ? `+${weaponPower}`: weaponPower}</div><div className="text-xs text-slate-500">Weapon Power</div></div>
                        <div><div className="text-2xl font-bold text-violet-400">{spellPower >= 0 ? `+${spellPower}`: spellPower}</div><div className="text-xs text-slate-500">Spell Power</div></div>
                    </div>
                </SheetSection>

                <SheetSection title="Saving Throws">{renderSavingThrows()}</SheetSection>
                <SheetSection title="Skills">{renderSkills()}</SheetSection>
                
                <SheetSection title="Features & Traits">
                    <div className="space-y-3 text-sm">
                        <div><h4 className="font-bold text-slate-300">Racial Traits</h4><ul className="list-disc list-inside text-slate-400 text-xs pl-2">{RACES[player.race]?.traits.map(t => <li key={t}>{t}</li>)}</ul></div>
                        <div><h4 className="font-bold text-slate-300">Class Features</h4><ul className="list-disc list-inside text-slate-400 text-xs pl-2">{CLASSES[player.class]?.features.map(f => <li key={f}>{f}</li>)}</ul></div>
                        <div><h4 className="font-bold text-slate-300">Background Feature</h4><p className="text-slate-400 text-xs pl-2">{BACKGROUNDS[player.background]?.feature}</p></div>
                    </div>
                </SheetSection>

                <SheetSection title="Status">
                     <div className="space-y-2">
                        <div className="flex justify-between text-sm"><span>Exhaustion</span><span className="font-mono text-red-400">{player.exhaustion} / 6</span></div>
                        <div className="flex justify-between text-sm"><span>Hunger</span><span className={`font-mono ${player.hungerDays > 0 ? "text-red-400" : "text-emerald-400"}`}>{player.hungerDays} days</span></div>
                        <div className="flex justify-between text-sm"><span>Thirst</span><span className={`font-mono ${player.thirstDays > 0 ? "text-red-400" : "text-emerald-400"}`}>{player.thirstDays} days</span></div>
                        <div className="flex justify-between text-sm"><span>Injuries</span><span className="font-mono text-slate-500">None</span></div>
                        <div className="flex justify-between text-sm"><span>Effects</span><span className="font-mono text-slate-500">None</span></div>
                     </div>
                </SheetSection>
            </div>
        </div>
    );
};

export const InventoryScreen: React.FC<ScreenProps> = ({ player, onClose }) => (
  <div className="absolute inset-0 bg-slate-950 flex flex-col z-20 animate-slide-in-from-bottom"><div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900"><h2 className="font-bold text-white">Inventory</h2><button onClick={() => { console.log('[DEBUG] Closing screen: Inventory'); onClose(); }}><X size={20}/></button></div><div className="flex-1 overflow-y-auto p-4 space-y-2">{player.inventory.map((item, i) => (<div key={i} className="flex justify-between items-center p-3 bg-slate-900 rounded-xl border border-slate-800"><span className="text-sm font-bold text-slate-200">{item.name}</span><span className="text-[10px] text-slate-500 uppercase">{item.type}</span></div>))}</div></div>
);

const EQUIPMENT_SLOTS = ['head', 'chest', 'legs', 'hands', 'feet', 'amulet', 'ring1', 'ring2', 'mainHand', 'offHand'];
export const EquipmentScreen: React.FC<{ player: Player; onClose: () => void; onEquip: (item: Item) => void; onUnequip: (slot: string) => void;}> = ({ player, onClose, onEquip, onUnequip }) => {
    const equippableItems = player.inventory.filter(i => i.slot);
    return (
        <div className="absolute inset-0 bg-slate-950 flex flex-col z-20 animate-slide-in-from-bottom">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900"><h2 className="font-bold text-white">Equipment</h2><button onClick={onClose}><X size={20}/></button></div>
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-4">
                <div className="col-span-1 space-y-2">
                    <h3 className="text-xs font-bold text-slate-500 uppercase">Equipped</h3>
                    {EQUIPMENT_SLOTS.map(slot => {
                        const item = player.equipment[slot];
                        const isBlocked = slot === 'offHand' && player.equipment.mainHand?.twoHanded;
                        return (
                            <div key={slot} onClick={() => item && onUnequip(slot)} className={`h-16 bg-slate-900 border rounded-xl flex items-center p-2 gap-2 transition-all ${item ? 'border-indigo-500 cursor-pointer hover:border-indigo-400' : 'border-slate-800'} ${isBlocked ? 'bg-slate-800/50 border-dashed' : ''}`}>
                                <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-slate-500 text-xs shrink-0">{slot.substring(0,4)}</div>
                                <div className="flex-1 overflow-hidden"><div className="text-xs text-slate-500 capitalize truncate">{slot.replace(/([A-Z1-9])/g, ' $1')}</div>
                                    {isBlocked ? <div className="text-sm font-bold text-slate-600">- Blocked -</div> : item ? <div className="text-sm font-bold text-slate-200 truncate">{item.name}</div> : <div className="text-sm font-bold text-slate-700">- Empty -</div>}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="col-span-1 space-y-2">
                    <h3 className="text-xs font-bold text-slate-500 uppercase">Equippable Items</h3>
                    {equippableItems.map((item, i) => (
                        <div key={`${item.id}-${i}`} onClick={() => onEquip(item)} className="p-3 bg-slate-900 rounded-xl border border-slate-800 cursor-pointer hover:border-slate-600">
                            <div className="font-bold text-sm text-slate-200">{item.name}</div>
                            <div className="text-xs text-slate-500 capitalize">{item.slot?.replace(/([A-Z1-9])/g, ' $1')}</div>
                        </div>
                    ))}
                    {equippableItems.length === 0 && <div className="text-center text-sm text-slate-600 p-4 rounded-xl border border-dashed border-slate-800 mt-2">No equippable items in bag.</div>}
                </div>
            </div>
        </div>
    );
};

interface SpellScreenProps extends ScreenProps {
    onCast: (spellName: string) => void;
}
export const SpellScreen: React.FC<SpellScreenProps> = ({ player, onClose, onCast }) => (
  <div className="absolute inset-0 bg-slate-950 flex flex-col z-20 animate-slide-in-from-bottom">
      <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
          <h2 className="font-bold text-white">Spellbook</h2>
          <button onClick={onClose}><X size={20}/></button>
      </div>
      <FilterSortList 
          items={player.spells || []} 
          // FIX: Use Array.from(new Set(...)) to ensure correct type inference. Spread syntax on a Set can result in `unknown[]` with some TypeScript configurations.
          filterOptions={Array.from(new Set((player.spells || []).map(s => s.school)))} 
          renderItem={(spell: Spell, i: number) => (
              <div key={i} className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                  <div className="flex justify-between items-start">
                      <div>
                          <div className="font-bold text-indigo-300">{spell.name}</div>
                          <div className="text-xs text-slate-500 mt-1">{spell.school} • {spell.target}</div>
                          <p className="text-xs text-slate-400 mt-2">
                              {spell.damage && `Deals ${spell.damage} damage. `}
                              {spell.heal && `Heals ${spell.heal} HP. `}
                              {spell.buff && `Grants ${spell.buff}. `}
                          </p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                          <div className="text-sm font-mono bg-slate-950 px-2 py-1 rounded text-blue-400">{spell.cost} MP</div>
                          <button 
                              onClick={() => onCast(spell.name)}
                              className="mt-2 text-xs bg-indigo-600 text-white px-3 py-1 rounded-md font-bold hover:bg-indigo-500 transition-colors"
                          >
                              Cast
                          </button>
                      </div>
                  </div>
              </div>
          )}
      />
  </div>
);
export const QuestScreen: React.FC<ScreenProps> = ({ player, onClose }) => (
  <div className="absolute inset-0 bg-slate-950 flex flex-col z-20 animate-slide-in-from-bottom"><div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900"><h2 className="font-bold text-white">Quests</h2><button onClick={() => { console.log('[DEBUG] Closing screen: Quests'); onClose(); }}><X size={20}/></button></div><FilterSortList items={player.quests || []} filterOptions={['active', 'completed']} renderItem={(quest: Quest, i: number) => (<div key={i} className="bg-slate-900 p-4 rounded-xl border border-slate-800"><div className="flex justify-between items-center mb-1"><div className="font-bold text-white">{quest.title}</div><span className="text-[10px] uppercase bg-slate-800 px-2 py-0.5 rounded text-slate-400">{quest.status}</span></div><div className="text-xs text-slate-400">{quest.description}</div></div>)}/></div>
);
export const FeatScreen: React.FC<ScreenProps> = ({ player, onClose }) => (<div className="absolute inset-0 bg-slate-950 flex flex-col z-20 animate-slide-in-from-bottom"><div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900"><h2 className="font-bold text-white">Feats</h2><button onClick={() => { console.log('[DEBUG] Closing screen: Feats'); onClose(); }}><X size={20}/></button></div><div className="flex-1 overflow-y-auto p-4 space-y-2">{FEATS_DB.map((feat, i) => (<div key={i} className="bg-slate-900 p-4 rounded-xl border border-slate-800"><div className="font-bold text-amber-400">{feat.name}</div><div className="text-xs text-slate-400">{feat.desc}</div></div>))}</div></div>);
export const FactionScreen: React.FC<ScreenProps> = ({ player, onClose }) => (<div className="absolute inset-0 bg-slate-950 flex flex-col z-20 animate-slide-in-from-bottom"><div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900"><h2 className="font-bold text-white">Factions</h2><button onClick={() => { console.log('[DEBUG] Closing screen: Factions'); onClose(); }}><X size={20}/></button></div><div className="flex-1 overflow-y-auto p-4 space-y-2">{Object.entries(player.factions || {}).map(([name, rep], i) => (<div key={i} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between"><div className="font-bold text-white">{name}</div><div className="text-xs text-slate-400">Rep: {rep}</div></div>))}</div></div>);
export const PartyScreen: React.FC<ScreenProps> = ({ player, onClose }) => (<div className="absolute inset-0 bg-slate-950 flex flex-col z-20 animate-slide-in-from-bottom"><div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900"><h2 className="font-bold text-white">Party</h2><button onClick={() => { console.log('[DEBUG] Closing screen: Party'); onClose(); }}><X size={20}/></button></div><div className="flex-1 overflow-y-auto p-4 text-center text-slate-500"><p>No companions yet.</p></div></div>);
export const MapScreen: React.FC<WorldScreenProps> = ({ world, onClose }) => (<div className="absolute inset-0 bg-slate-950 flex flex-col z-20 animate-slide-in-from-bottom"><div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900"><h2 className="font-bold text-white">World Map</h2><button onClick={() => { console.log('[DEBUG] Closing screen: World Map'); onClose(); }}><X size={20}/></button></div><div className="flex-1 flex items-center justify-center text-slate-600 bg-slate-900"><p>Map Region: Oakhaven</p></div></div>);
export const JournalScreen: React.FC<{log: LogEntry[], world: World, onClose: () => void}> = ({ log, world, onClose }) => (<div className="absolute inset-0 bg-slate-950 flex flex-col z-20 animate-slide-in-from-bottom"><div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900"><h2 className="font-bold text-white">Journal</h2><button onClick={() => { console.log('[DEBUG] Closing screen: Journal'); onClose(); }}><X size={20}/></button></div><div className="flex-1 overflow-y-auto p-4 space-y-6"><div className="bg-indigo-900/20 p-4 rounded-xl border border-indigo-500/30"><h3 className="text-xs font-bold text-indigo-400 uppercase mb-2">Facts</h3><ul className="list-disc list-inside text-xs text-slate-300">{world.facts.map((f, i) => <li key={i}>{f}</li>)}</ul></div><div><h3 className="text-xs font-bold text-slate-500 uppercase mb-2">History</h3>{log.slice().reverse().map((l, i) => (<div key={i} className="text-sm text-slate-300 border-l-2 border-slate-700 pl-3 py-1 mb-2">{l.text}</div>))}</div></div></div>);
export const CodexScreen: React.FC<{world: World, player: Player, onClose: () => void}> = ({ player, onClose }) => (<div className="absolute inset-0 bg-slate-950 flex flex-col z-20 animate-slide-in-from-bottom"><div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900"><h2 className="font-bold text-white">Codex</h2><button onClick={() => { console.log('[DEBUG] Closing screen: Codex'); onClose(); }}><X size={20}/></button></div><div className="flex-1 overflow-y-auto p-4 space-y-4">{(!player.knownNPCs || player.knownNPCs.length === 0) && <div className="text-center text-slate-500">No NPCs discovered yet.</div>}{player.knownNPCs?.map((npc, i) => (<div key={i} className="bg-slate-900 p-4 rounded-xl border border-slate-800"><div className="font-bold text-white">{npc.name}</div><div className="text-xs text-slate-400">{npc.role} • {npc.location}</div></div>))}</div></div>);
export const SettingsPage: React.FC<{onClose: () => void}> = ({ onClose }) => (<div className="absolute inset-0 bg-slate-950 flex flex-col z-30"><div className="p-4 border-b border-slate-800 flex justify-between items-center"><h2 className="text-xl font-bold text-white">Settings</h2><button onClick={() => { console.log('[DEBUG] Closing screen: Settings'); onClose(); }}><X size={20}/></button></div><div className="p-4 space-y-4"><div className="bg-slate-900 p-4 rounded-xl border border-slate-800"><h3 className="font-bold text-amber-400 mb-2 flex items-center gap-2"><AlertTriangle size={16}/> AI Configuration</h3><p className="text-xs text-slate-400">Credentials managed by environment.</p></div></div></div>);

// FIX: Add missing ShopScreen component to fix import error in App.tsx
interface ShopScreenProps {
  player: Player;
  shop: { name: string; inventory: Item[] };
  onClose: () => void;
  onBuy: (item: Item) => void;
  onSell: (item: Item, index: number) => void;
}

export const ShopScreen: React.FC<ShopScreenProps> = ({ player, shop, onClose, onBuy, onSell }) => {
  return (
    <div className="absolute inset-0 bg-slate-950 flex flex-col z-20 animate-slide-in-from-bottom">
      <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
        <h2 className="font-bold text-white">{shop.name}</h2>
        <div className="flex items-center gap-2">
            <span className="text-amber-400 font-mono text-xs flex items-center gap-1"><Coins size={12}/> {formatCurrency(player.currency)}</span>
            <button onClick={onClose}><X size={20}/></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-4">
        <div className="col-span-1 space-y-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase">For Sale</h3>
            {shop.inventory.map((item, i) => (
                <div key={`${item.id || item.name}-${i}`} className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex justify-between items-center">
                    <div>
                        <div className="font-bold text-sm text-slate-200">{item.name}</div>
                        <div className="text-xs text-amber-500 font-mono">{formatCurrency(item.value || 0)}</div>
                    </div>
                    <button onClick={() => onBuy(item)} disabled={player.currency < (item.value || 0)} className="px-3 py-1 bg-indigo-600 text-white font-bold text-xs rounded-lg disabled:bg-slate-700 disabled:text-slate-500">Buy</button>
                </div>
            ))}
             {shop.inventory.length === 0 && <div className="text-center text-sm text-slate-600 p-4 rounded-xl border border-dashed border-slate-800 mt-2">Sold out!</div>}
        </div>
        <div className="col-span-1 space-y-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase">Your Items to Sell</h3>
            {player.inventory.map((item, i) => (
                 <div key={`${item.id || item.name}-${i}`} className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex justify-between items-center">
                    <div>
                        <div className="font-bold text-sm text-slate-200 truncate">{item.name}</div>
                        <div className="text-xs text-amber-500 font-mono">{formatCurrency(Math.floor((item.value || 0) / 2))}</div>
                    </div>
                    {(item.value || 0) > 0 && 
                        <button onClick={() => onSell(item, i)} className="px-3 py-1 bg-slate-700 text-white font-bold text-xs rounded-lg">Sell</button>
                    }
                </div>
            ))}
            {player.inventory.length === 0 && <div className="text-center text-sm text-slate-600 p-4 rounded-xl border border-dashed border-slate-800 mt-2">Your bag is empty.</div>}
        </div>
      </div>
    </div>
  );
};

interface MainMenuProps { setView: (v:string)=>void; onClose: () => void; onSaveGame: () => void; onNewGame: () => void; }
export const MainMenu: React.FC<MainMenuProps> = ({ setView, onClose, onSaveGame, onNewGame }) => {
  const [saveMessage, setSaveMessage] = useState('');
  const handleSaveClick = () => {
      onSaveGame();
      setSaveMessage('Game Saved!');
      setTimeout(() => setSaveMessage(''), 2000);
  };
  const menuItems = ['Inventory', 'Journal', 'Map', 'Settings', 'Spells', 'Codex', 'Quests', 'Factions', 'Party', 'Feats'];

  return (
    <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col justify-center p-8 z-50 animate-in fade-in">
      <button onClick={onClose} className="absolute top-4 right-4 text-slate-400"><X size={24}/></button>
      <h2 className="text-3xl font-black text-white mb-8 text-center tracking-tighter">MENU</h2>
      <div className="grid grid-cols-2 gap-4">
        {menuItems.map(label => (
          <button key={label} onClick={() => { console.log(`[DEBUG] MainMenu navigation to: ${label.toLowerCase()}`); setView(label.toLowerCase()); }} className="bg-slate-900 border border-slate-700 p-6 rounded-2xl flex flex-col items-center gap-3 hover:bg-slate-800 transition-all">
            <span className="font-bold text-sm text-slate-200">{label}</span>
          </button>
        ))}
      </div>
      <div className="mt-6 pt-6 border-t border-slate-800 flex gap-4">
        <button onClick={handleSaveClick} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl text-sm transition-colors disabled:bg-indigo-800" disabled={!!saveMessage}>
          {saveMessage || 'Save Game'}
        </button>
        <button onClick={onNewGame} className="flex-1 py-3 bg-red-800 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-colors">
          New Game
        </button>
      </div>
    </div>
  );
};

export const FilterSortList = ({ items, renderItem, filterOptions = [] }: { items: any[], renderItem: (item: any, i: number) => React.ReactNode, filterOptions: string[] }) => {
  const [search, setSearch] = useState(""); const [filter, setFilter] = useState("all");
  const filtered = items.filter(i => (filter === 'all' || i.type === filter || i.school === filter || i.rarity === filter || i.status === filter) && (i.name?.toLowerCase().includes(search.toLowerCase()) || i.title?.toLowerCase().includes(search.toLowerCase())));
  return (<div className="flex flex-col h-full"><div className="p-4 border-b border-slate-800 space-y-3"><div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/><input className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 pl-10 pr-4 text-sm focus:border-indigo-500 outline-none" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} /></div>{filterOptions.length > 0 && (<div className="flex gap-2 overflow-x-auto pb-1"><button onClick={() => { console.log('[DEBUG] FilterSortList filter set to: all'); setFilter('all'); }} className={`px-3 py-1 rounded text-xs font-bold whitespace-nowrap ${filter === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>All</button>{filterOptions.map(opt => (<button key={opt} onClick={() => { console.log(`[DEBUG] FilterSortList filter set to: ${opt}`); setFilter(opt); }} className={`px-3 py-1 rounded text-xs font-bold whitespace-nowrap ${filter === opt ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{opt}</button>))}</div>)}</div><div className="flex-1 overflow-y-auto p-4 space-y-2">{filtered.map((item, i) => renderItem(item, i))}{filtered.length === 0 && <div className="text-center text-slate-600 mt-10">Nothing found.</div>}</div></div>);
};

export const Landing: React.FC<{ onStart: () => void }> = ({ onStart }) => (<div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center font-sans"><div className="w-24 h-24 bg-indigo-600/20 rounded-3xl flex items-center justify-center mb-8 border border-indigo-500/50 shadow-[0_0_40px_-10px_rgba(79,70,229,0.5)]"><Flame size={48} className="text-indigo-500 animate-pulse" /></div><h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-500 mb-4 tracking-tighter">MYTHIC REALMS</h1><button onClick={() => { console.log('[DEBUG] Landing button clicked: Enter World'); onStart(); }} className="w-full max-w-xs py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-indigo-900/20 active:scale-95 flex items-center justify-center gap-2">Enter World</button></div>);

const CreationInput = ({ label, value, onChange, placeholder }) => (
    <section>
        <label className="text-xs uppercase font-bold text-slate-500 block mb-2">{label}</label>
        <input className="w-full bg-slate-900 border border-slate-700 p-4 rounded-xl text-white outline-none focus:border-indigo-500" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </section>
);
const CreationGrid = ({ label, options, selected, onSelect }) => (
    <section>
        <label className="text-xs uppercase font-bold text-slate-500 block mb-2">{label}</label>
        <div className="grid grid-cols-2 gap-2">{Object.keys(options).map(key => <button key={key} onClick={() => onSelect(key)} className={`p-3 rounded-xl border text-xs font-bold text-left ${selected === key ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>{key}</button>)}</div>
    </section>
);

const STATS: (keyof Player['stats'])[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export const CharacterCreator: React.FC<{ onComplete: (data: Player) => void, onBack: () => void }> = ({ onComplete, onBack }) => {
    const [step, setStep] = useState(1);
    
    const [data, setData] = useState(() => {
        const initialRace = "Human";
        const initialClass = "Fighter";
        const initialStats = assignDefaultStats(initialRace, initialClass);
        return { 
            name: "Kael", 
            concept: "A heroic warrior destined for greatness.", 
            race: initialRace, 
            class: initialClass, 
            background: "Soldier", 
            stats: initialStats, 
            personality: { traits: "Brave and honorable.", ideals: "Justice for all.", bonds: "My family's legacy.", flaws: "Too trusting." } 
        };
    });

    useEffect(() => {
        setData(d => ({ ...d, stats: assignDefaultStats(d.race, d.class) }));
    }, [data.race, data.class]);

    const finalPlayer = useMemo((): Player | null => {
        // FIX: `Object.values` returns `unknown[]`, so `s` must be converted to a number before `isNaN` is called.
        if (Object.keys(data.stats).length < 6 || Object.values(data.stats).some(s => isNaN(Number(s)))) {
            return null;
        }
        return {
            ...data,
            level: 1, xp: 0,
            proficiencies: { skills: [...(BACKGROUNDS[data.background]?.skills || []), ...(CLASSES[data.class]?.skills || [])], savingThrows: CLASSES[data.class]?.savingThrows || [] },
            exhaustion: 0, hungerDays: 0, thirstDays: 0,
            spells: [], quests: [], factions: {}, knownNPCs: [], equipment: {},
            currency: 1000,
            inventory: [],
            hpMax: 0, hpCurrent: 0, manaMax: 0, manaCurrent: 0, staminaMax: 0, staminaCurrent: 0, ac: 0
        };
    }, [data]);
    
    const isStepComplete = () => {
        switch(step) {
            case 1: return !!(data.name.trim() && data.concept.trim());
            case 5: return Object.values(data.stats).every(val => typeof val === 'number' && !isNaN(val));
            case 6: return !!(data.personality.traits.trim() && data.personality.ideals.trim() && data.personality.bonds.trim() && data.personality.flaws.trim());
            default: return true;
        }
    };

    const handleComplete = () => {
        if(finalPlayer) onComplete(finalPlayer);
    }
    
    const renderStep = () => {
        switch (step) {
            case 1: return (<>
                <CreationInput label="Name" value={data.name} onChange={v => setData({...data, name: v})} placeholder="Enter your hero's name" />
                <CreationInput label="Concept" value={data.concept} onChange={v => setData({...data, concept: v})} placeholder="e.g., A knight who protects the weak..." />
            </>);
            case 2: return (<CreationGrid label="Race / Species" options={RACES} selected={data.race} onSelect={v => setData({...data, race: v})} />);
            case 3: return (<CreationGrid label="Class" options={CLASSES} selected={data.class} onSelect={v => setData({...data, class: v})} />);
            case 4: return (<CreationGrid label="Background" options={BACKGROUNDS} selected={data.background} onSelect={v => setData({...data, background: v})} />);
            case 5: return (<>
                <label className="text-xs uppercase font-bold text-slate-500 block mb-2">Ability Scores</label>
                <p className="text-sm text-slate-400 mb-4">Scores are automatically assigned based on your Race and Class. You can edit them freely below.</p>
                <div className="grid grid-cols-2 gap-4">
                {STATS.map(stat => (
                    <div key={stat} className="bg-slate-800 p-3 rounded-xl">
                        <div className="flex justify-between items-center">
                            <label className="font-bold uppercase text-indigo-400">{stat}</label>
                            <span className="text-lg font-mono text-white bg-slate-900 px-2 rounded">
{/* FIX: Cast stat value to number to resolve TypeScript error. */}
                                {getMod(data.stats[stat] as number) >= 0 ? `+${getMod(data.stats[stat] as number)}` : getMod(data.stats[stat] as number)}
                            </span>
                        </div>
                        <input 
                            type="number"
                            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-center text-2xl font-bold mt-2 outline-none focus:border-indigo-500"
                            value={data.stats[stat] as number}
                            onChange={e => {
                                const value = parseInt(e.target.value, 10) || 0;
                                setData(d => ({ ...d, stats: { ...d.stats, [stat]: value } }));
                            }}
                        />
                    </div>
                ))}
                </div>
            </>);
            case 6: return (<>
                <CreationInput label="Personality Traits" value={data.personality.traits} onChange={v => setData({...data, personality: {...data.personality, traits: v}})} placeholder="Describe your hero's personality..." />
                <CreationInput label="Ideals" value={data.personality.ideals} onChange={v => setData({...data, personality: {...data.personality, ideals: v}})} placeholder="What does your hero believe in?" />
                <CreationInput label="Bonds" value={data.personality.bonds} onChange={v => setData({...data, personality: {...data.personality, bonds: v}})} placeholder="What is important to your hero?" />
                <CreationInput label="Flaws" value={data.personality.flaws} onChange={v => setData({...data, personality: {...data.personality, flaws: v}})} placeholder="What are your hero's weaknesses?" />
            </>);
            default: return <div>Review</div>
        }
    }

    return (<div className="h-screen bg-slate-950 flex flex-col font-sans">
      <div className="p-6 border-b border-slate-800 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack}><ChevronRight className="rotate-180 text-slate-500"/></button>
          <h2 className="text-xl font-bold text-white">Create Hero (Step {step}/6)</h2>
        </div>
        <div className="text-xs text-slate-500">{['Concept', 'Race', 'Class', 'Background', 'Stats', 'Personality'][step-1]}</div>
      </div>
      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        {renderStep()}
      </div>
      <div className="p-6 border-t border-slate-800 flex gap-4">
        {step > 1 && <button onClick={() => setStep(s => s - 1)} className="flex-1 py-4 bg-slate-800 font-bold rounded-xl text-white">Back</button>}
        {step < 6 && <button onClick={() => setStep(s => s + 1)} disabled={!isStepComplete()} className="flex-1 py-4 bg-indigo-600 font-bold rounded-xl text-white disabled:bg-indigo-900 disabled:text-slate-500">Next</button>}
        {step === 6 && <button onClick={handleComplete} disabled={!isStepComplete()} className="w-full py-4 bg-indigo-600 font-bold rounded-xl text-white shadow-lg active:scale-95 disabled:bg-indigo-900 disabled:text-slate-500">Begin Adventure</button>}
      </div>
    </div>);
};

export const Bar: React.FC<{label: string, cur: number, max: number, color: string, icon: React.ReactNode}> = ({ label, cur, max, color, icon }) => (<div className="flex-1 bg-slate-950/30 p-1.5 rounded-lg border border-slate-800/50"><div className="flex justify-between text-[9px] font-bold text-slate-500 mb-1 uppercase items-center"><span className="flex items-center gap-1">{icon} {label}</span><span>{cur}/{max}</span></div><div className="h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full ${color} transition-all duration-500`} style={{width: `${max > 0 ? Math.min(100, (cur/max)*100) : 0}%`}}></div></div></div>);
export const NavBtn: React.FC<{icon: React.ReactNode, label: string, active: boolean, onClick: ()=>void}> = ({ icon, label, active, onClick }) => (<button onClick={() => { console.log(`[DEBUG] NavBtn clicked: ${label}`); onClick(); }} className={`flex flex-col items-center justify-center gap-1.5 p-1 w-full text-center transition-colors rounded-lg ${active ? 'bg-slate-800 text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>{icon}<span className="text-[9px] font-bold uppercase tracking-wide">{label}</span></button>);

interface StartScreenProps {
  onLoadGame: (slotId: string) => void;
  onNewGameStart: (slotId: string) => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({ onLoadGame, onNewGameStart }) => {
  const [slotSummaries, setSlotSummaries] = useState<SaveSlotSummary[]>([]);
  const NUM_SLOTS = 5;

  useEffect(() => {
    const fetchSummaries = async () => {
      const summaries = await getAllSaveSlotSummaries(NUM_SLOTS);
      setSlotSummaries(summaries);
    };
    fetchSummaries();
  }, []);

  const handleClearSlot = (slotId: string) => {
    if (window.confirm(`Are you sure you want to delete save slot ${slotId}? This cannot be undone.`)) {
      deleteSaveLocal(slotId);
      // Refresh summaries
      getAllSaveSlotSummaries(NUM_SLOTS).then(setSlotSummaries);
    }
  };

  return (
    <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center font-sans">
      <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-500 mb-8 tracking-tighter">CHRONICLES GATEWAY</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-lg">
        {slotSummaries.map((summary, index) => (
          <div key={`slot-${index + 1}`} className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col justify-between h-40">
            <h3 className="text-xl font-bold text-indigo-400 mb-2">Slot {index + 1}</h3>
            {summary.exists ? (
              <>
                <p className="text-sm text-white mb-1">
                  <span className="font-bold">{summary.playerName}</span>, Lv.{summary.playerLevel}
                </p>
                <p className="text-xs text-slate-400">Day {summary.worldDay}</p>
                <div className="mt-auto flex justify-between gap-2">
                  <button onClick={() => onLoadGame(`slot${index + 1}`)} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-sm transition-colors flex items-center justify-center gap-1">
                    <Play size={16}/> Load
                  </button>
                  <button onClick={() => handleClearSlot(`slot${index + 1}`)} className="py-2 px-3 bg-red-900/40 border border-red-700/50 hover:bg-red-800/60 text-red-400 font-bold rounded-lg text-sm transition-colors">
                    <X size={16}/>
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-500 italic flex-1 flex items-center justify-center">Empty</p>
                <button onClick={() => onNewGameStart(`slot${index + 1}`)} className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-sm transition-colors flex items-center justify-center gap-1">
                  <Save size={16}/> New Game
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
