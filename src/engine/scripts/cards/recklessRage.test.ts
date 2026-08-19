// `Reckless Rage` — two clauses, two targets, one event: 4 kills their
// Strix, and the 2 at my own Bears is the CARD's price, killing them too.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { RECKLESS_RAGE_SCRIPT } from './recklessRage';
import { RECKLESS_RAGE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { parseTargetClauses } from '../../../data/targetParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function rage(): { g: Game; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Reckless Rage', 'Grizzly Bears'], ['Baleful Strix']],
    scripts: createRegistry([RECKLESS_RAGE_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', 'Baleful Strix');
  settle(g);
  const spell = put(g, 'p1', 'Reckless Rage', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'card', id: theirs },
        { kind: 'card', id: mine },
      ],
    }),
  );
  settle(g);
  return { g, mine, theirs };
}

describe('Reckless Rage', () => {
  test('the parser reads BOTH clauses — the premise the whole card stands on', () => {
    // A one-clause read would prompt for one target and half-execute; this
    // failing means Reckless Rage must be PULLED, not worked around (D90).
    const text = RECKLESS_RAGE.faces[0]?.oracleText ?? '';
    expect(parseTargetClauses(text).length).toBe(2);
  });

  test('4 kills their Strix, 2 kills my own Bears — both clauses land', () => {
    const { g, mine, theirs } = rage();
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = RECKLESS_RAGE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, RECKLESS_RAGE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(RECKLESS_RAGE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = rage();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
