// `Squall Line` — X off the stack object: the flyer dies at X=3, the
// grounded Bears stand, and EVERY player — caster included — takes X.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { SQUALL_LINE_SCRIPT } from './squallLine';
import { SQUALL_LINE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function storm(): { g: Game; flyer: InstanceId; ground: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Squall Line', 'Grizzly Bears'], ['Baleful Strix']],
    scripts: createRegistry([SQUALL_LINE_SCRIPT]),
  });
  const flyer = put(g, 'p2', 'Baleful Strix');
  const ground = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  const spell = put(g, 'p1', 'Squall Line', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: 3 }));
  settle(g);
  return { g, flyer, ground };
}

describe('Squall Line', () => {
  test('X=3: the flyer dies, the grounded creature stands, BOTH players take 3', () => {
    const { g, flyer, ground } = storm();
    expect(g.state.cards[flyer]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[ground]?.zone.kind).toBe('battlefield');
    expect(g.state.players['p1']?.life).toBe(37);
    expect(g.state.players['p2']?.life).toBe(37);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = SQUALL_LINE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, SQUALL_LINE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(SQUALL_LINE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = storm();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
