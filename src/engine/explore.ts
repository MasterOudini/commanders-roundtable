// D409 - EXPLORE (CR 701.42): reveal the top card of your library; a land card goes to your hand,
// anything else puts a +1/+1 counter on the exploring permanent and MAY go to your graveyard. The
// graveyard question is a surveil 1 over the revealed card - the scry prompt with `toGraveyard`
// (D195) carrying `explore` - and the permanent has EXPLORED (`Explored`, the trigger bus's event)
// once the process is complete (701.42c): at once for a land, at the answer for anything else. An
// empty library reveals nothing and the permanent still gets its counter (the release notes' rule);
// a permanent that has left the battlefield gets no counter and the rest still happens (701.42b).
// "Explores, then explores again" is a chain: the second explore runs against the state the first
// left, and waits behind the first's question when there is one (`remaining` rides the prompt).

import { derive } from './derive';
import type { EngineDeps } from './loop';
import { n, narrated, vb, who, whose } from './narrate';
import { apply } from './reducer';
import type { EventBody } from './types/events';
import type { InstanceId, PlayerId } from './types/ids';
import type { GameState } from './types/state';

/** One explore: the reveal, the land's move or the counter and the question, the marker for a land. */
export function exploreOnce(state: GameState, deps: EngineDeps, controller: PlayerId, permanent: InstanceId, label: string, remaining: number): EventBody[] {
  const out: EventBody[] = [];
  const library = state.zones.library[controller] ?? [];
  const top = library[library.length - 1];
  const inst = state.cards[permanent];
  const onBattlefield = inst !== undefined && inst.zone.kind === 'battlefield';
  const subject = onBattlefield ? derive(state, deps.oracle, deps.scripts, permanent).name : label;
  const counter: EventBody[] = onBattlefield ? [{ t: 'CountersChanged', changes: [{ card: permanent, kind: '+1/+1', delta: 1 }] }] : [];
  if (top === undefined) {
    out.push(...counter);
    out.push(narrated(n`${subject} explores: ${whose(state, controller)} library is empty${onBattlefield ? ', so it gets a +1/+1 counter' : ''}.`, controller));
    out.push({ t: 'Explored', permanent, controller, card: null, land: false });
    return out;
  }
  const revealed = derive(state, deps.oracle, deps.scripts, top);
  out.push({ t: 'CardsRevealed', cards: [top], to: [...state.seating] });
  if (revealed.typeLine.types.includes('Land')) {
    out.push({ t: 'CardsMoved', moves: [{ card: top, from: { kind: 'library', player: controller }, to: { kind: 'hand', player: controller } }] });
    out.push({ t: 'CardsRevealed', cards: [top], to: [] });
    out.push(narrated(n`${subject} explores: ${who(state, controller)} ${vb(controller, 'reveals', 'reveal')} ${revealed.name}, a land, and ${vb(controller, 'puts', 'put')} it into hand.`, controller));
    out.push({ t: 'Explored', permanent, controller, card: top, land: true });
    return out;
  }
  out.push(...counter);
  out.push(narrated(n`${subject} explores: ${who(state, controller)} ${vb(controller, 'reveals', 'reveal')} ${revealed.name}${onBattlefield ? ' and it gets a +1/+1 counter' : ''}; it may go to the graveyard.`, controller));
  out.push({
    t: 'AwaitingSet',
    awaiting: { kind: 'scryChoice', player: controller, count: 1, toGraveyard: true, thenDraw: 0, label, explore: { permanent, remaining } },
  });
  return out;
}

/** `times` explores in a row; stops behind a question, which carries what is left. */
export function exploreChain(state: GameState, deps: EngineDeps, controller: PlayerId, permanent: InstanceId, label: string, times: number): EventBody[] {
  const out: EventBody[] = [];
  let scratch = state;
  for (let i = 0; i < times; i++) {
    const events = exploreOnce(scratch, deps, controller, permanent, label, times - i - 1);
    out.push(...events);
    if (events.some((e) => e.t === 'AwaitingSet')) break;
    for (const body of events) scratch = apply(scratch, { seq: scratch.eventCount, body, cause: { kind: 'system' } } as never);
  }
  return out;
}
