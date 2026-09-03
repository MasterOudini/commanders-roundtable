// `Zombie Infestation` — two discarded cards of my choice (no mana) make a
// 2/2 Zombie; one card is refused.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ZOMBIE_INFESTATION_SCRIPT } from './zombieInfestation';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const INFESTATION = 'Zombie Infestation';
const ZOMBIE = TOKEN_TABLE['Zombie|2/2|B|Creature|'];

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function zombies(g: Game, player: string): number {
  return g.state.zones.battlefield.filter((id) => {
    const c = g.state.cards[id];
    return !!c && c.isToken && c.controller === player && c.printingId === ZOMBIE?.printingId;
  }).length;
}

function placed(): { g: Game; infestation: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[INFESTATION], []],
    scripts: createRegistry([ZOMBIE_INFESTATION_SCRIPT]),
  });
  const infestation = put(g, 'p1', INFESTATION);
  settle(g);
  return { g, infestation };
}

describe('Zombie Infestation (discard two)', () => {
  test('two cards discarded: a 2/2 Zombie', () => {
    const { g, infestation } = placed();
    const hand = idsIn(g, 'p1', 'hand');
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: infestation, abilityIndex: 0, discard: [hand[0] as InstanceId, hand[1] as InstanceId], targets: [] }));
    settle(g);
    expect(zombies(g, 'p1')).toBe(1);
    expect(g.state.cards[hand[0] as InstanceId]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[hand[1] as InstanceId]?.zone.kind).toBe('graveyard');
    expect(idsIn(g, 'p1', 'hand').length).toBe(hand.length - 2);
  });

  test('one card is refused', () => {
    const { g, infestation } = placed();
    const hand = idsIn(g, 'p1', 'hand');
    expect(g.submit({ t: 'ActivateAbility', player: 'p1', card: infestation, abilityIndex: 0, discard: [hand[0] as InstanceId], targets: [] }).ok).toBe(false);
    expect(zombies(g, 'p1')).toBe(0);
  });

  test('replays to the same hash', () => {
    const { g, infestation } = placed();
    const hand = idsIn(g, 'p1', 'hand');
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: infestation, abilityIndex: 0, discard: [hand[0] as InstanceId, hand[1] as InstanceId], targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
