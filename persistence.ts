import { doc, setDoc, onSnapshot, Firestore, DocumentSnapshot, Unsubscribe } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { Player, World, LogEntry, Choice, Enemy } from './types/worldState';
import { appId } from './firebase';

export const saveGame = async (db: Firestore, user: User, p: Player, w: World, l: LogEntry[], c: Choice[], v: string, enemy: Enemy | null, sceneImage: string | null) => {
    if (!user || !db) return;
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'saves', 'active'), { player: p, world: w, log: l, choices: c, view: v, enemy: enemy, sceneImage: sceneImage, updatedAt: Date.now() });
};

export const subscribeToSave = (db: Firestore, user: User, callbacks: {
    onData: (data: any) => void;
}): Unsubscribe => {
    return onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'saves', 'active'), (d: DocumentSnapshot) => {
        if (d.exists()) {
            callbacks.onData(d.data());
        }
    });
};