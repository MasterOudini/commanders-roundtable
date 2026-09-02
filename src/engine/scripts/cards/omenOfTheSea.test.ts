// `Omen of the Sea` — the entry scries 2 and THEN draws (the kept top card);
// the sacrifice scries 2 alone.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { OMEN_OF_THE_SEA_SCRIPT } from './omenOfTheSea';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const OMEN = 'Omen of the Sea';

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

function atTheAsk(): { g: Game; omen: InstanceId; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[OMEN], []],
    scripts: createRegistry([OMEN_OF_THE_SEA_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  const logAt = g.log.length;
  const omen = put(g, 'p1', OMEN);
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 60_000);
  return { g, omen, logAt };
}

function revealed(g: Game): [InstanceId, InstanceId] {
  const lib = g.state.zones.library['p1'] ?? [];
  const r = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  expect(r.length).toBe(2);
  return r as [InstanceId, InstanceId];
}

describe('Omen of the Sea', () => {
  test('the entry asks a scry 2 with a draw to follow, and draws the kept card', () => {
    const { g, logAt } = atTheAsk();
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind === 'scryChoice' && awaiting.count === 2 && awaiting.thenDraw === 1).toBe(true);
    const [a, b] = revealed(g);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [b], toBottom: [a] }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    expect(g.state.cards[b]?.zone).toEqual({ kind: 'hand', player: 'p1' });
    expect(g.state.cards[a]?.zone.kind).toBe('library');
  });

  test('{2}{U}, sacrifice: scry 2 with no draw', () => {
    const { g, omen } = atTheAsk();
    const [a, b] = revealed(g);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [b], toBottom: [a] }));
    settle(g);
    advanceUntil(g, (s) => s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    const logAt = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: omen, abilityIndex: 0, targets: [] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    const again = g.state.priority.awaiting;
    expect(again?.kind === 'scryChoice' && again.thenDraw === 0).toBe(true);
    const [c, d] = revealed(g);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [c, d], toBottom: [] }));
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(0);
    expect(g.state.cards[omen]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g } = atTheAsk();
    const [a, b] = revealed(g);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [b], toBottom: [a] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
