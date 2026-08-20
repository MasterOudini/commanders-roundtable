// `Neutralize the Guards` — the target opponent's 1/1 dies, MY 1/1 stands,
// and the surveil ask lands LAST.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { NEUTRALIZE_THE_GUARDS_SCRIPT } from './neutralizeTheGuards';
import { NEUTRALIZE_THE_GUARDS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function neutralized(): { g: Game; theirs: InstanceId; mine: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Neutralize the Guards', 'Aysen Bureaucrats'], ['Aysen Bureaucrats']],
    scripts: createRegistry([NEUTRALIZE_THE_GUARDS_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Aysen Bureaucrats');
  const theirs = put(g, 'p2', 'Aysen Bureaucrats');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Neutralize the Guards', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(
    g.submit({
      t: 'CastSpell',
      player: 'p1',
      card: spell,
      targets: [{ kind: 'player', id: 'p2' }],
    }),
  );
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  return { g, theirs, mine };
}

describe('Neutralize the Guards', () => {
  test("the opponent's 1/1 dies, mine stands, and the surveil 2 asks", () => {
    const { g, theirs, mine } = neutralized();
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind).toBe('scryChoice');
    expect(awaiting?.kind === 'scryChoice' && awaiting.count).toBe(2);
    advanceUntil(g, (s) => s.priority.awaiting === null, 20_000);
    settle(g);
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mine]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = NEUTRALIZE_THE_GUARDS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, NEUTRALIZE_THE_GUARDS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(NEUTRALIZE_THE_GUARDS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = neutralized();
    advanceUntil(g, (s) => s.priority.awaiting === null, 20_000);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
