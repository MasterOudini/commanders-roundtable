// Structural checks run after every event in dev and in every test.
//
// ⚠️ These are not "nice extra assertions". The replay fuzzer runs
// `assertInvariants` after EVERY event across 500 seeds × 200 intents, and that
// is what turns "the state is corrupt somewhere in the last 40 000 events" into
// "event 137 of seed 12 put c41 in two zones at once". Without them a fuzzer
// only catches crashes and hash mismatches, both of which point at the symptom
// rather than the cause.

import type { InstanceId } from './types/ids';
import type { GameState } from './types/state';

export class InvariantError extends Error {
  constructor(
    message: string,
    readonly eventCount: number,
  ) {
    super(`invariant violated after event ${eventCount}: ${message}`);
    this.name = 'InvariantError';
  }
}

/** Returns the problems rather than throwing, so a caller can report them all. */
export function checkInvariants(state: GameState): string[] {
  const problems: string[] = [];
  const seen = new Map<InstanceId, string>();

  const claim = (id: InstanceId, where: string): void => {
    const prior = seen.get(id);
    if (prior) problems.push(`${id} is in both ${prior} and ${where}`);
    else seen.set(id, where);
  };

  for (const id of state.zones.battlefield) claim(id, 'battlefield');
  for (const p of state.seating) {
    for (const [name, list] of [
      ['library', state.zones.library[p]],
      ['hand', state.zones.hand[p]],
      ['graveyard', state.zones.graveyard[p]],
      ['exile', state.zones.exile[p]],
      ['command', state.zones.command[p]],
    ] as const) {
      for (const id of list ?? []) claim(id, `${name}:${p}`);
    }
  }
  for (const obj of state.stack) if (obj.card) claim(obj.card, `stack:${obj.id}`);

  // Every card is somewhere, and its own `zone` agrees with where it is.
  for (const [id, card] of Object.entries(state.cards)) {
    // ⚠️ THE STACK HAS NO ZONE ARRAY. A card is on the stack from CR 601.2a —
    // the moment it is moved there to begin a cast — but the `StackObject` that
    // names it is created by the LATER `SpellCast` event. Requiring the object
    // to exist made every single cast fail the invariant in the window between
    // the two events, which the fuzzer would report as a corrupt state.
    if (card.zone.kind === 'stack') continue;
    const where = seen.get(id);
    if (!where) {
      problems.push(`${id} (${card.oracleId}) is in no zone`);
      continue;
    }
    const expected =
      card.zone.kind === 'battlefield' ? 'battlefield' : `${card.zone.kind}:${card.zone.player}`;
    if (where !== expected) problems.push(`${id} says it is in ${expected} but sits in ${where}`);
    if (!state.players[card.owner]) problems.push(`${id} is owned by unknown player ${card.owner}`);
    if (!state.players[card.controller]) {
      problems.push(`${id} is controlled by unknown player ${card.controller}`);
    }
    for (const [kind, n] of Object.entries(card.counters)) {
      if (!Number.isInteger(n) || n <= 0) problems.push(`${id} has a ${kind} counter count of ${n}`);
    }
    if (card.damage < 0) problems.push(`${id} has negative damage`);
    // ⚠️ Both directions of an attachment, every time. Clearing one side leaves
    // a dead id in the other, and the aura-falls SBA then fires on a permanent
    // that no longer exists — a crash several turns after the real mistake.
    if (card.attachedTo !== null) {
      const host = state.cards[card.attachedTo];
      if (!host) problems.push(`${id} is attached to missing ${card.attachedTo}`);
      else if (!host.attachments.includes(id)) {
        problems.push(`${id} is attached to ${host.id}, which does not list it`);
      } else if (host.zone.kind !== 'battlefield') {
        problems.push(`${id} is attached to ${host.id}, which is not on the battlefield`);
      }
    }
    for (const attached of card.attachments) {
      const other = state.cards[attached];
      if (!other) problems.push(`${id} lists missing attachment ${attached}`);
      else if (other.attachedTo !== id) problems.push(`${id} lists ${attached}, which is not attached to it`);
    }
    if (card.zone.kind !== 'battlefield') {
      if (card.tapped) problems.push(`${id} is tapped outside the battlefield`);
      if (card.damage !== 0) problems.push(`${id} has damage outside the battlefield`);
      if (card.attachments.length > 0) problems.push(`${id} has attachments outside the battlefield`);
    }
  }

  // No zone lists a card that does not exist, and none lists one twice.
  for (const [where, list] of zoneLists(state)) {
    const set = new Set(list);
    if (set.size !== list.length) problems.push(`${where} contains a duplicate`);
    for (const id of list) if (!state.cards[id]) problems.push(`${where} lists missing card ${id}`);
  }

  for (const p of state.seating) {
    const player = state.players[p];
    if (!player) {
      problems.push(`seating names unknown player ${p}`);
      continue;
    }
    if (!Number.isInteger(player.life)) problems.push(`${p} has non-integer life ${player.life}`);
    if (player.poison < 0) problems.push(`${p} has negative poison`);
    for (const [k, v] of Object.entries(player.pool)) {
      if (v < 0) problems.push(`${p} has a negative ${k} in their mana pool`);
    }
    for (const id of player.commanderIds) {
      const card = state.cards[id];
      if (!card) problems.push(`${p} names missing commander ${id}`);
      else if (card.owner !== p) problems.push(`${p} names ${id} as commander but ${card.owner} owns it`);
    }
    for (const [from, amount] of Object.entries(player.commanderDamage)) {
      if (amount < 0) problems.push(`${p} has negative commander damage from ${from}`);
    }
  }

  if (state.priority.player !== null && !state.players[state.priority.player]) {
    problems.push(`priority is with unknown player ${state.priority.player}`);
  }
  for (const p of state.priority.passedSinceLastAction) {
    if (!state.seating.includes(p)) problems.push(`${p} passed but is not seated`);
  }

  for (const obj of state.stack) {
    if (obj.card !== null && !state.cards[obj.card]) {
      problems.push(`stack object ${obj.id} names missing card ${obj.card}`);
    }
    if (!state.players[obj.controller]) {
      problems.push(`stack object ${obj.id} is controlled by unknown player ${obj.controller}`);
    }
  }

  if (state.combat) {
    for (const a of state.combat.attackers) {
      if (!state.cards[a.card]) problems.push(`attacker ${a.card} does not exist`);
      for (const b of a.blockerOrder) {
        if (!state.cards[b]) problems.push(`blocker ${b} in ${a.card}'s order does not exist`);
      }
    }
    for (const b of state.combat.blockers) {
      if (!state.cards[b.card]) problems.push(`blocker ${b.card} does not exist`);
    }
  }

  if (state.pendingCast && !state.cards[state.pendingCast.card]) {
    problems.push(`pending cast names missing card ${state.pendingCast.card}`);
  }

  return problems;
}

function zoneLists(state: GameState): [string, readonly InstanceId[]][] {
  const out: [string, readonly InstanceId[]][] = [['battlefield', state.zones.battlefield]];
  for (const p of state.seating) {
    out.push([`library:${p}`, state.zones.library[p] ?? []]);
    out.push([`hand:${p}`, state.zones.hand[p] ?? []]);
    out.push([`graveyard:${p}`, state.zones.graveyard[p] ?? []]);
    out.push([`exile:${p}`, state.zones.exile[p] ?? []]);
    out.push([`command:${p}`, state.zones.command[p] ?? []]);
  }
  return out;
}

export function assertInvariants(state: GameState): void {
  const problems = checkInvariants(state);
  if (problems.length > 0) throw new InvariantError(problems.join('; '), state.eventCount);
}
