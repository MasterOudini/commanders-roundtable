// `Lavalanche` — X = 2 at the player AND each of their creatures; my
// side never notices.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { LAVALANCHE_SCRIPT } from './lavalanche';
import { LAVALANCHE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function slid(): { g: Game; theirs: InstanceId; mine: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Lavalanche', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([LAVALANCHE_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Lavalanche', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: 2 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
  settle(g);
  return { g, theirs, mine };
}

describe('Lavalanche', () => {
  test("X = 2 at the player and their 2/2; my creature is untouched", () => {
    const { g, theirs, mine } = slid();
    expect(g.state.players['p2']?.life).toBe(38);
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mine]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[mine]?.damage).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = LAVALANCHE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, LAVALANCHE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(LAVALANCHE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = slid();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
