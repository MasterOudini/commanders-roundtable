// `Blessed Reversal` — 3 life per creature attacking ME, cast mid-combat
// with the attack declared (Aetherize's window).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BLESSED_REVERSAL_SCRIPT } from './blessedReversal';
import { BLESSED_REVERSAL } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function reversed(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Blessed Reversal'], ['Grizzly Bears', 'Llanowar Elves']],
    scripts: createRegistry([BLESSED_REVERSAL_SCRIPT]),
  });
  const a = put(g, 'p2', 'Grizzly Bears');
  const b = put(g, 'p2', 'Llanowar Elves');
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.activePlayer === 'p2' && s.priority.awaiting?.kind === 'declareAttackers',
    60_000,
  );
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p2',
      attackers: [
        { card: a, defender: { kind: 'player', id: 'p1' } },
        { card: b, defender: { kind: 'player', id: 'p1' } },
      ],
    }),
  );
  advanceUntil(g, (s) => s.priority.player === 'p1' && (s.combat?.attackers.length ?? 0) > 0, 20_000);
  const spell = put(g, 'p1', 'Blessed Reversal', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return g;
}

describe('Blessed Reversal', () => {
  test('two attackers at ME pay 6 life', () => {
    const g = reversed();
    expect(g.state.players['p1']?.life).toBe(46);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BLESSED_REVERSAL.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BLESSED_REVERSAL.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BLESSED_REVERSAL.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = reversed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
