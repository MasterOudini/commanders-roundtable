// `Witching Well` — entering asks a scry 2 (two cards shown); four mana and
// the Well itself buy two cards.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { WITCHING_WELL_SCRIPT } from './witchingWell';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const WELL = 'Witching Well';

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

function placed(): { g: Game; well: InstanceId; shown: number } {
  const g = startedGame({
    players: 2,
    decks: [[WELL], []],
    scripts: createRegistry([WITCHING_WELL_SCRIPT]),
  });
  const well = put(g, 'p1', WELL);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [...revealed], toBottom: [] }));
  settle(g);
  return { g, well, shown: revealed.length };
}

describe('Witching Well', () => {
  test('entering asks a scry 2', () => {
    const { shown } = placed();
    expect(shown).toBe(2);
  });

  test('{3}{U}, sacrifice: two cards, the Well gone', () => {
    const { g, well } = placed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: well, abilityIndex: 0, targets: [] }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(2);
    expect(g.state.cards[well]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, well } = placed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: well, abilityIndex: 0, targets: [] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
