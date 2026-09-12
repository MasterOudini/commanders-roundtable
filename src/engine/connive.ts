// D412 - CONNIVE (CR 701.50): draw a card, then discard a card; if a nonland card was discarded this
// way, put a +1/+1 counter on the conniving permanent. The discard is the hand prompt (`chooseFromZone`,
// D137) carrying `connive`, and the permanent has CONNIVED (`Connived`, the trigger bus's event) once
// the process is complete (701.50c) - at the answer, or at once when there is nothing to discard. An
// empty library draws nothing (the loss is the state-based check's, CR 704.5b) and the discard still
// happens; a permanent that has left the battlefield gets no counter and the rest still happens.
// "Connives, then connives again" is a chain: the second runs against the state the first left.

import { derive } from './derive';
import type { EngineDeps } from './loop';
import { drawEvents } from './effects';
import { n, narrated, vb, who } from './narrate';
import { apply } from './reducer';
import type { EventBody } from './types/events';
import type { InstanceId, PlayerId } from './types/ids';
import type { GameState } from './types/state';

/** The events of ONE connive up to its question: the draw, then the discard prompt or the empty-hand end. */
export function conniveOnce(state: GameState, deps: EngineDeps, controller: PlayerId, permanent: InstanceId, label: string, remaining: number): EventBody[] {
  const out: EventBody[] = [];
  const inst = state.cards[permanent];
  const subject = inst !== undefined && inst.zone.kind === 'battlefield' ? derive(state, deps.oracle, deps.scripts, permanent).name : label;
  out.push(...drawEvents(state, controller, 1));
  let scratch = state;
  for (const body of out) scratch = apply(scratch, { seq: scratch.eventCount, body, cause: { kind: 'system' } } as never);
  const hand = scratch.zones.hand[controller] ?? [];
  if (hand.length === 0) {
    out.push(narrated(n`${subject} connives: ${who(state, controller)} ${vb(controller, 'has', 'have')} no card to discard.`, controller));
    out.push({ t: 'Connived', permanent, controller, card: null, nonland: false });
    return out;
  }
  out.push(narrated(n`${subject} connives: ${who(state, controller)} ${vb(controller, 'draws', 'draw')}, then ${vb(controller, 'discards', 'discard')} a card.`, controller));
  out.push({
    t: 'AwaitingSet',
    awaiting: { kind: 'chooseFromZone', player: controller, zone: 'hand', rest: null, count: 1, label, connive: { permanent, remaining } },
  });
  return out;
}

/** After the discard was answered: the counter for a nonland card, the marker, and the chain's remainder. */
export function conniveAfterDiscard(state: GameState, deps: EngineDeps, controller: PlayerId, permanent: InstanceId, discarded: readonly InstanceId[], label: string, remaining: number): EventBody[] {
  const out: EventBody[] = [];
  const card = discarded[0] ?? null;
  const nonland = card !== null && !derive(state, deps.oracle, deps.scripts, card).typeLine.types.includes('Land');
  const inst = state.cards[permanent];
  const onBattlefield = inst !== undefined && inst.zone.kind === 'battlefield';
  if (nonland && onBattlefield) {
    out.push({ t: 'CountersChanged', changes: [{ card: permanent, kind: '+1/+1', delta: 1 }] });
    out.push(narrated(`${derive(state, deps.oracle, deps.scripts, permanent).name} gets a +1/+1 counter for the nonland card.`, controller));
  }
  out.push({ t: 'Connived', permanent, controller, card, nonland });
  if (remaining > 0) {
    let scratch = state;
    for (const body of out) scratch = apply(scratch, { seq: scratch.eventCount, body, cause: { kind: 'system' } } as never);
    out.push(...conniveChain(scratch, deps, controller, permanent, label, remaining));
  }
  return out;
}

/** `times` connives in a row; stops behind a question, which carries what is left. */
export function conniveChain(state: GameState, deps: EngineDeps, controller: PlayerId, permanent: InstanceId, label: string, times: number): EventBody[] {
  const out: EventBody[] = [];
  let scratch = state;
  for (let i = 0; i < times; i++) {
    const events = conniveOnce(scratch, deps, controller, permanent, label, times - i - 1);
    out.push(...events);
    if (events.some((e) => e.t === 'AwaitingSet')) break;
    for (const body of events) scratch = apply(scratch, { seq: scratch.eventCount, body, cause: { kind: 'system' } } as never);
  }
  return out;
}
