// `Prescient Chimera` — my instant asks the scry; my creature spell and
// an opponent's instant do not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { PRESCIENT_CHIMERA_SCRIPT } from './prescientChimera';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function chimeric(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Prescient Chimera', 'Lightning Bolt', 'Grizzly Bears'], []],
    scripts: createRegistry([PRESCIENT_CHIMERA_SCRIPT]),
  });
  put(g, 'p1', 'Prescient Chimera');
  settle(g);
  return g;
}

function answerScry(g: Game): void {
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'))[0] as InstanceId;
  must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [revealed], toBottom: [] }));
  advanceUntil(g, (s) => s.priority.awaiting === null, 20_000);
}

describe('Prescient Chimera', () => {
  test('my instant raises the ask; my creature spell does not', () => {
    const g = chimeric();
    const bears = put(g, 'p1', 'Grizzly Bears', 'hand');
    advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bears }));
    settle(g);
    expect(g.state.priority.awaiting?.kind).not.toBe('scryChoice');
    const bolt = put(g, 'p1', 'Lightning Bolt', 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'player', id: 'p2' }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    answerScry(g);
    settle(g);
    expect(g.state.players['p2']?.life).toBe(37);
  });

  test('replays to the same hash', () => {
    const g = chimeric();
    const bolt = put(g, 'p1', 'Lightning Bolt', 'hand');
    advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: bolt, targets: [{ kind: 'player', id: 'p2' }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    answerScry(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
