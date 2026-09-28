// D577 - DAY AND NIGHT (CR 726) and DAYBOUND / NIGHTBOUND (CR 702.145): the game's designation turns, and the permanents
// whose face it names transform with it.
import { derive } from './derive';
import { narrated } from './narrate';
import { faceOf } from './oracle';
import type { EngineDeps } from './loop';
import type { EventBody } from './types/events';
import type { InstanceId } from './types/ids';
import type { GameState } from './types/state';

/**
 * It becomes `to`: the designation, then every daybound permanent (as it becomes night) or nightbound one (as it becomes
 * day) that `present` admits transforms - its other face up (CR 702.145b/e; a transform is no zone change, CR 701.28: its
 * counters, damage and attachments stay). A face-down permanent has no daybound to read (CR 708.2).
 */
export function dayNightChange(state: GameState, deps: EngineDeps, to: 'day' | 'night', present: (id: InstanceId) => boolean): EventBody[] {
  const events: EventBody[] = [{ t: 'DayNightChanged', to }, narrated(`It becomes ${to}.`, null)];
  const bound = to === 'night' ? 'daybound' : 'nightbound';
  const face = to === 'night' ? 1 : 0;
  for (const id of state.zones.battlefield) {
    const card = state.cards[id];
    if (!card || card.faceDown || card.faceIndex === face || !present(id)) continue;
    const printing = deps.oracle.byPrinting(card.printingId);
    if (!printing || printing.faces.length < 2) continue;
    if (!derive(state, deps.oracle, deps.scripts, id).keywords.has(bound)) continue;
    events.push({ t: 'FaceIndexSet', card: id, faceIndex: face });
    events.push(narrated(`${faceOf(printing, card.faceIndex).name} transforms into ${faceOf(printing, face).name}.`, card.controller));
  }
  return events;
}

/**
 * The untap step's check (CR 502.2): if it's day and the previous turn's active player cast no spells during that turn,
 * it becomes night; if it's night and they cast two or more, it becomes day. `TurnBegan` carried their count
 * (`TurnState.dayNightCasts`) - only once it is day or night, so a game with neither never reads it.
 */
export function dayNightAtUntap(state: GameState, deps: EngineDeps, present: (id: InstanceId) => boolean): EventBody[] {
  const casts = state.turn.dayNightCasts;
  if (state.dayNight === undefined || casts === undefined) return [];
  const to = state.dayNight === 'day' && casts === 0 ? 'night' : state.dayNight === 'night' && casts >= 2 ? 'day' : null;
  return to === null ? [] : dayNightChange(state, deps, to, present);
}
