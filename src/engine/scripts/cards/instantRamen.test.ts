// `Instant Ramen` — a card on entry; two mana, the tap and the Ramen buy 3
// life.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { INSTANT_RAMEN_SCRIPT } from './instantRamen';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const RAMEN = 'Instant Ramen';

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

function served(): { g: Game; ramen: InstanceId; entryDraws: number } {
  const g = startedGame({
    players: 2,
    decks: [[RAMEN], []],
    scripts: createRegistry([INSTANT_RAMEN_SCRIPT]),
  });
  settle(g);
  const logAt = g.log.length;
  const ramen = put(g, 'p1', RAMEN);
  settle(g);
  return { g, ramen, entryDraws: drawsFor(g, 'p1', logAt) };
}

describe('Instant Ramen', () => {
  test('entering draws one', () => {
    const { entryDraws } = served();
    expect(entryDraws).toBe(1);
  });

  test('{2}, {T}, sacrifice: 3 life, the Ramen gone', () => {
    const { g, ramen } = served();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: ramen, abilityIndex: 0, targets: [] }));
    settle(g);
    expect(g.state.players['p1']?.life).toBe(43);
    expect(g.state.cards[ramen]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, ramen } = served();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: ramen, abilityIndex: 0, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
