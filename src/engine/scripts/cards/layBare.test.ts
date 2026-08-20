// `Lay Bare` — the spell dies and its controller's hand is revealed to
// ME alone.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { LAY_BARE_SCRIPT } from './layBare';
import { LAY_BARE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function bared(): { g: Game; spell: InstanceId; kept: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Lay Bare'], ['Grizzly Bears', 'Elvish Herder']],
    scripts: createRegistry([LAY_BARE_SCRIPT]),
  });
  const kept = put(g, 'p2', 'Elvish Herder', 'hand');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p2', 'Grizzly Bears', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'G', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p2', card: spell }));
  advanceUntil(g, (s) => s.priority.player === 'p1' && s.stack.length > 0, 20_000);
  const stackId = g.state.stack.find((o) => o.card === spell)?.id as string;
  const counter = put(g, 'p1', 'Lay Bare', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: counter }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
  settle(g);
  return { g, spell, kept };
}

describe('Lay Bare', () => {
  test('the Bears is countered and the hand is revealed to the CASTER alone', () => {
    const { g, spell, kept } = bared();
    expect(g.state.cards[spell]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[kept]?.revealedTo.includes('p1')).toBe(true);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = LAY_BARE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, LAY_BARE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(LAY_BARE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = bared();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
