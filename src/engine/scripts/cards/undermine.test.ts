// `Undermine` — the counter plus a 3-life bill on the COUNTERED spell's
// controller, driven by a real held cast.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { UNDERMINE_SCRIPT } from './undermine';
import { UNDERMINE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Undermine';
const HELD = 'Dark Ritual'; // instant-speed, so it can sit on the stack

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function countered(): { g: Game; held: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [HELD]],
    scripts: createRegistry([UNDERMINE_SCRIPT]),
  });
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber >= 2 && s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain',
    120_000,
  );
  // p2 casts something and it sits on the stack.
  const held = put(g, 'p2', HELD, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p2', card: held }));
  // ⚠️ The caster RETAINS priority after casting — p1 cannot respond until it
  // comes round (Illumination's shipped test does exactly this).
  advanceUntil(g, (s) => s.priority.player === 'p1' && s.stack.length > 0, 20_000);
  const stackId = g.state.stack.find((o) => o.card === held)?.id as string;
  expect(stackId).toBeDefined();

  // p1 responds.
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
  settle(g);
  return { g, held };
}

describe('Undermine', () => {
  test('the spell is countered into its graveyard and ITS controller pays 3', () => {
    const { g, held } = countered();
    expect(g.state.cards[held]?.zone.kind).toBe('graveyard');
    expect(g.state.players.p2?.life).toBe(37);
    // The caster pays nothing.
    expect(g.state.players.p1?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = UNDERMINE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, UNDERMINE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(UNDERMINE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = countered();
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
