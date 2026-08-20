// `Illumination` — the artifact spell dies on the stack and its caster
// banks the mana value.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { ILLUMINATION_SCRIPT } from './illumination';
import { ILLUMINATION } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function illuminated(): { g: Game; ring: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Illumination'], ['Sol Ring']],
    scripts: createRegistry([ILLUMINATION_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain', 60_000);
  const ring = put(g, 'p2', 'Sol Ring', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p2', card: ring }));
  advanceUntil(g, (s) => s.priority.player === 'p1' && s.stack.length > 0, 20_000);
  const stackId = g.state.stack.find((o) => o.card === ring)?.id as string;
  const counter = put(g, 'p1', 'Illumination', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: counter }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
  settle(g);
  return { g, ring };
}

describe('Illumination', () => {
  test('the Ring is countered to the graveyard and its caster gains its mana value', () => {
    const { g, ring } = illuminated();
    expect(g.state.cards[ring]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(41);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = ILLUMINATION.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, ILLUMINATION.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(ILLUMINATION.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = illuminated();
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
