// `Aether Tradewinds` — two clauses, two bounces, each to its OWNER.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { AETHER_TRADEWINDS_SCRIPT } from './aetherTradewinds';
import { AETHER_TRADEWINDS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { parseTargetClauses } from '../../../data/targetParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): { g: Game; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Aether Tradewinds', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([AETHER_TRADEWINDS_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  const spell = put(g, 'p1', 'Aether Tradewinds', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'card', id: mine },
        { kind: 'card', id: theirs },
      ],
    }),
  );
  settle(g);
  return { g, mine, theirs };
}

describe('Aether Tradewinds', () => {
  test('the parser reads BOTH clauses — the premise the card stands on', () => {
    const text = AETHER_TRADEWINDS.faces[0]?.oracleText ?? '';
    expect(parseTargetClauses(text).length).toBe(2);
  });

  test('both permanents go home to their OWNERS', () => {
    const { g, mine, theirs } = cast();
    expect(g.state.cards[mine]?.zone.kind).toBe('hand');
    expect((g.state.zones.hand['p1'] ?? []).includes(mine)).toBe(true);
    expect(g.state.cards[theirs]?.zone.kind).toBe('hand');
    expect((g.state.zones.hand['p2'] ?? []).includes(theirs)).toBe(true);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = AETHER_TRADEWINDS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, AETHER_TRADEWINDS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(AETHER_TRADEWINDS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
