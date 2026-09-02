// `Futurist Forge` — a card on entry; four mana and the Forge for two more.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { FUTURIST_FORGE_SCRIPT } from './futuristForge';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const FORGE = 'Futurist Forge';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/**
 * Cards drawn, counted by MOVE: a multi-card draw is ONE CardsMoved event
 * carrying every card (drawEvents batches), so counting events reads 1.
 */
function drawsFor(g: Game, player: string, from: number): number {
  let n = 0;
  for (const e of g.log.slice(from)) {
    if (e.body.t !== 'CardsMoved') continue;
    n += e.body.moves.filter((m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player).length;
  }
  return n;
}

function placed(): { g: Game; forge: InstanceId; entryDraws: number } {
  const g = startedGame({
    players: 2,
    decks: [[FORGE], []],
    scripts: createRegistry([FUTURIST_FORGE_SCRIPT]),
  });
  settle(g);
  const logAt = g.log.length;
  const forge = put(g, 'p1', FORGE);
  settle(g);
  return { g, forge, entryDraws: drawsFor(g, 'p1', logAt) };
}

describe('Futurist Forge', () => {
  test('entering draws one', () => {
    const { entryDraws } = placed();
    expect(entryDraws).toBe(1);
  });

  test('{3}{U}, sacrifice: two cards, the Forge gone', () => {
    const { g, forge } = placed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: forge, abilityIndex: 0, targets: [] }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(2);
    expect(g.state.cards[forge]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, forge } = placed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: forge, abilityIndex: 0, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
