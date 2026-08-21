// `Stand United` — an Ally target adds the scry ask; a Bears just pumps.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { STAND_UNITED_SCRIPT } from './standUnited';
import { derive } from '../../derive';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function united(name: string): { g: Game; target: InstanceId; asked: boolean } {
  const g = startedGame({
    players: 2,
    decks: [['Stand United', name], []],
    scripts: createRegistry([STAND_UNITED_SCRIPT]),
  });
  const target = put(g, 'p1', name);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Stand United', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
  advanceUntil(
    g,
    (s) => s.priority.awaiting?.kind === 'scryChoice' || (s.stack.length === 0 && s.pendingTriggers.length === 0),
    20_000,
  );
  const asked = g.state.priority.awaiting?.kind === 'scryChoice';
  if (asked) {
    const lib = g.state.zones.library['p1'] ?? [];
    const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    advanceUntil(g, (s) => s.priority.awaiting === null, 20_000);
  }
  settle(g);
  return { g, target, asked };
}

describe('Stand United', () => {
  test('an Ally gets the pump AND the scry', () => {
    const { g, target, asked } = united('Sokka, Lateral Strategist');
    expect(asked).toBe(true);
    expect(derive(g.state, ORACLE, g.deps.scripts, target).power).toBeGreaterThanOrEqual(3);
  });

  test('a Bears gets only the pump', () => {
    const { g, target, asked } = united('Grizzly Bears');
    expect(asked).toBe(false);
    expect(derive(g.state, ORACLE, g.deps.scripts, target).power).toBe(4);
  });

  test('replays to the same hash', () => {
    const { g } = united('Grizzly Bears');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
