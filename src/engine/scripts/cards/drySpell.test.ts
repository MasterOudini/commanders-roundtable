// `Dry Spell` — 1 to everything: the 1/1 dies, the 2/2 stands, both
// players take 1.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DRY_SPELL_SCRIPT } from './drySpell';
import { DRY_SPELL } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function dried(): { g: Game; strix: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Dry Spell'], ['Baleful Strix', 'Grizzly Bears']],
    scripts: createRegistry([DRY_SPELL_SCRIPT]),
  });
  const strix = put(g, 'p2', 'Baleful Strix');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Dry Spell', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, strix, bears };
}

describe('Dry Spell', () => {
  test('the 1/1 dies, the 2/2 stands, both players take 1', () => {
    const { g, strix, bears } = dried();
    expect(g.state.cards[strix]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(g.state.players['p1']?.life).toBe(39);
    expect(g.state.players['p2']?.life).toBe(39);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DRY_SPELL.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DRY_SPELL.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DRY_SPELL.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = dried();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
