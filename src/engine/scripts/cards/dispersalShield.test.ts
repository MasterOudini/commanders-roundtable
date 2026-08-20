// `Dispersal Shield` — with a 6-drop on my board the 2-drop spell is
// countered; with only a 1-drop the same spell resolves — the bound is
// real and board-computed.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DISPERSAL_SHIELD_SCRIPT } from './dispersalShield';
import { DISPERSAL_SHIELD } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function shielded(board: 'Colossal Dreadmaw' | 'Sol Ring'): { g: Game; spell: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Dispersal Shield', 'Colossal Dreadmaw', 'Sol Ring'], ['Grizzly Bears']],
    scripts: createRegistry([DISPERSAL_SHIELD_SCRIPT]),
  });
  put(g, 'p1', board);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p2', 'Grizzly Bears', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p2', target: 'p2', symbol: 'G', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p2', card: spell }));
  advanceUntil(g, (s) => s.priority.player === 'p1' && s.stack.length > 0, 20_000);
  const stackId = g.state.stack.find((o) => o.card === spell)?.id as string;
  const counter = put(g, 'p1', 'Dispersal Shield', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: counter }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'stack', id: stackId }] }));
  settle(g);
  return { g, spell };
}

describe('Dispersal Shield', () => {
  test('a 6-drop on my board counters the 2-drop spell', () => {
    const { g, spell } = shielded('Colossal Dreadmaw');
    expect(g.state.cards[spell]?.zone.kind).toBe('graveyard');
  });

  test('with only a 1-drop the same spell resolves — the bound is real', () => {
    const { g, spell } = shielded('Sol Ring');
    expect(g.state.cards[spell]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DISPERSAL_SHIELD.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DISPERSAL_SHIELD.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DISPERSAL_SHIELD.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = shielded('Colossal Dreadmaw');
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
