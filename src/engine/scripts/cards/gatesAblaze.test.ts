// `Gates Ablaze` — X is the Gate count: zero Gates is a true no-op, one
// Gate deals 1 to each creature.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { GATES_ABLAZE_SCRIPT } from './gatesAblaze';
import { GATES_ABLAZE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ablaze(gates: number): { g: Game; herder: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Gates Ablaze', 'Azorius Guildgate'], ['Elvish Herder', 'Grizzly Bears']],
    scripts: createRegistry([GATES_ABLAZE_SCRIPT]),
  });
  if (gates > 0) put(g, 'p1', 'Azorius Guildgate');
  const herder = put(g, 'p2', 'Elvish Herder');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Gates Ablaze', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, herder, bears };
}

describe('Gates Ablaze', () => {
  test('no Gates: X is 0 and nothing is dealt', () => {
    const { g, herder, bears } = ablaze(0);
    expect(g.state.cards[herder]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[herder]?.damage).toBe(0);
    expect(g.state.cards[bears]?.damage).toBe(0);
  });

  test('one Guildgate: the 1/1 dies and the 2/2 carries 1', () => {
    const { g, herder, bears } = ablaze(1);
    expect(g.state.cards[herder]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[bears]?.damage).toBe(1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = GATES_ABLAZE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, GATES_ABLAZE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(GATES_ABLAZE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = ablaze(1);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
