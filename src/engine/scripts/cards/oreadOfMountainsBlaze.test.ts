// `Oread of Mountain's Blaze` — three mana and a discarded card buy a card;
// no tap, so it works the turn it enters.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { OREAD_OF_MOUNTAINS_BLAZE_SCRIPT } from './oreadOfMountainsBlaze';
import { advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const OREAD = "Oread of Mountain's Blaze";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawsFor(g: Game, player: string, from: number): number {
  let n = 0;
  for (const e of g.log.slice(from)) {
    if (e.body.t !== 'CardsMoved') continue;
    n += e.body.moves.filter((m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player).length;
  }
  return n;
}

function ready(): { g: Game; oread: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[OREAD], []],
    scripts: createRegistry([OREAD_OF_MOUNTAINS_BLAZE_SCRIPT]),
  });
  const oread = put(g, 'p1', OREAD);
  settle(g);
  return { g, oread };
}

describe("Oread of Mountain's Blaze", () => {
  test('{2}{R}, discard a card: draw a card, twice in a turn', () => {
    const { g, oread } = ready();
    const hand = idsIn(g, 'p1', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: oread, abilityIndex: 0, discard: [hand[0] as InstanceId], targets: [] }));
    settle(g);
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: oread, abilityIndex: 0, discard: [hand[1] as InstanceId], targets: [] }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(2);
    expect(g.state.cards[hand[0] as InstanceId]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[hand[1] as InstanceId]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, oread } = ready();
    const chosen = idsIn(g, 'p1', 'hand')[0] as InstanceId;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: oread, abilityIndex: 0, discard: [chosen], targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
