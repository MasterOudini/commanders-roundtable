// `Unified Will` — the two-sided census, proven at BOTH sides of the
// boundary: strictly more counters, a tie does not.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { UNIFIED_WILL_SCRIPT } from './unifiedWill';
import { UNIFIED_WILL } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Unified Will';
const BEARS = 'Grizzly Bears';
const HELD = 'Dark Ritual';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/** p1 gets `mine` creatures, p2 gets `theirs`, then p2 casts and p1 answers. */
function tried(mine: number, theirs: number): { g: Game; held: InstanceId } {
  const deckA = [SPELL];
  for (let i = 0; i < mine; i++) deckA.push(BEARS);
  const deckB = [HELD];
  for (let i = 0; i < theirs; i++) deckB.push(BEARS);
  const g = startedGame({
    players: 2,
    decks: [deckA, deckB],
    scripts: createRegistry([UNIFIED_WILL_SCRIPT]),
  });
  for (let i = 0; i < mine; i++) put(g, 'p1', BEARS);
  for (let i = 0; i < theirs; i++) put(g, 'p2', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) => s.turn.turnNumber >= 2 && s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain',
    120_000,
  );
  const held = put(g, 'p2', HELD, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p2', card: held }));
  // The caster retains priority; wait for it to come round (D263).
  advanceUntil(g, (s) => s.priority.player === 'p1' && s.stack.length > 0, 20_000);
  const stackId = g.state.stack.find((o) => o.card === held)?.id as string;
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
  settle(g);
  return { g, held };
}

describe('Unified Will', () => {
  test('MORE creatures counters the spell', () => {
    const { g, held } = tried(2, 1);
    expect(g.state.cards[held]?.zone.kind).toBe('graveyard');
    expect(g.log.filter((e) => e.body.t === 'SpellCountered').length).toBe(1);
  });

  test('a TIE does not — the card says strictly more', () => {
    const { g } = tried(1, 1);
    // ⚠️ A countered spell and a resolved one BOTH end in the graveyard, so
    // the zone proves nothing here. The tell is the LOG: no SpellCountered.
    const counters = g.log.filter((e) => e.body.t === 'SpellCountered').length;
    expect(counters).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = UNIFIED_WILL.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, UNIFIED_WILL.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(UNIFIED_WILL.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = tried(2, 1);
    const turn = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber > turn, 120_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
