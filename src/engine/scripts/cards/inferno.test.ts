// `Inferno` — 6 to everything: both small creatures die, both players
// burn, the 6-toughness body carries exactly 6.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { INFERNO_SCRIPT } from './inferno';
import { INFERNO } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function burned(): { g: Game; mine: InstanceId; theirs: InstanceId; big: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Inferno', 'Grizzly Bears'], ['Elvish Herder', 'Colossal Dreadmaw']],
    scripts: createRegistry([INFERNO_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', 'Elvish Herder');
  const big = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Inferno', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 5 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs, big };
}

describe('Inferno', () => {
  test('every creature dies — 6 is lethal even to the 6/6 — and both players take 6', () => {
    const { g, mine, theirs, big } = burned();
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[big]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(34);
    expect(g.state.players['p2']?.life).toBe(34);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = INFERNO.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, INFERNO.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(INFERNO.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = burned();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
