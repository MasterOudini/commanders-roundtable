// D623 - PLAYING FROM THE TOP OF THE LIBRARY. A library is hidden (CR 401.2); a permanent's static ability opens its top:
// `You may look at the top card of your library any time.` (look), `Play with the top card of your library revealed.`
// (revealed), `You may play lands from the top of your library.` (lands), `You may cast <noun> spells from the top of your
// library.` (spells) - a `TopOfLibraryDef` on the permanent's script, consulted here for the offers (`legal.ts`), the
// land play and the cast (`handlers.ts`) and the projection (`project.ts`). The TOP is the END of the library array
// (`drawFromTop`), and only the top: the card under it is no more playable than any other card of the library.
import { derive, makeDeriveCache } from './derive';
import { mergedScripts } from './mutate';
import { defOnFace, type TopOfLibraryDef } from './scripts/api';
import { inPlay } from './zones';
import { predicateAdmits } from '../data/replacementParse';
import type { ScriptRegistry } from './scripts/registryCore';
import type { InstanceId, PlayerId } from './types/ids';
import type { OracleDb, OracleFace } from './types/oracle';
import type { GameState } from './types/state';

/** The top card of a player's library, or null when it is empty. */
export function libraryTop(state: GameState, player: PlayerId): InstanceId | null {
  const lib = state.zones.library[player] ?? [];
  return lib[lib.length - 1] ?? null;
}

/**
 * Every top-of-library def on a permanent `player` controls whose abilities it still has (a face-down permanent has none;
 * a silenced one neither - its DERIVED `hasAbilities`). The registry's list is the gate: empty, nothing is walked.
 */
export function topDefs(state: GameState, oracle: OracleDb, scripts: ScriptRegistry, player: PlayerId): readonly TopOfLibraryDef[] {
  if (scripts.topOfLibrary().length === 0) return [];
  const out: TopOfLibraryDef[] = [];
  const cache = makeDeriveCache(state);
  for (const id of inPlay(state)) {
    const inst = state.cards[id];
    if (!inst || inst.controller !== player || inst.faceDown) continue;
    let able: boolean | null = null;
    for (const { script, faceIndex } of mergedScripts(scripts, state, inst)) {
      for (const def of script.topOfLibrary ?? []) {
        if (!defOnFace(def, faceIndex)) continue;
        if (able === null) able = derive(state, oracle, scripts, id, cache).hasAbilities;
        if (!able) break;
        out.push(def);
      }
    }
  }
  return out;
}

/**
 * May `player` play `card` (its face `face`) from the top of their own library: the card IS the top, and a def they hold
 * admits it - a land face under `lands`, a spell face under `spells` (any spell, or the printed noun - its negations
 * and its predicates, asked of the face as printed).
 */
export function playsFromTop(state: GameState, oracle: OracleDb, scripts: ScriptRegistry, player: PlayerId, card: InstanceId, face: OracleFace): boolean {
  const inst = state.cards[card];
  if (!inst || inst.zone.kind !== 'library' || inst.zone.player !== player || libraryTop(state, player) !== card) return false;
  const defs = topDefs(state, oracle, scripts, player);
  if (face.isLand) return defs.some((d) => d.lands === true);
  return defs.some((d) => {
    const s = d.spells;
    if (s === undefined) return false;
    if (s === 'any') return true;
    if ((s.none ?? []).some((t) => face.typeLine.types.includes(t))) return false;
    return s.predicates.length === 0 || predicateAdmits(face, s.predicates);
  });
}

/**
 * Does `viewer` see the top card of `owner`'s library: every seat while a reveal holds (`revealed`), its owner while any
 * permission does (a look, or one to play it - a card cannot be chosen unseen).
 */
export function seesTop(state: GameState, oracle: OracleDb, scripts: ScriptRegistry, viewer: PlayerId, owner: PlayerId): boolean {
  const defs = topDefs(state, oracle, scripts, owner);
  if (defs.some((d) => d.revealed === true)) return true;
  return viewer === owner && defs.length > 0;
}
