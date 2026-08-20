// `Filigree Fracture` — the colorless Ring dies and draws nothing; the
// blue-black Strix (an artifact CREATURE, still an artifact) dies and
// draws one.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FILIGREE_FRACTURE_SCRIPT } from './filigreeFracture';
import { FILIGREE_FRACTURE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function fractured(name: 'Sol Ring' | 'Baleful Strix'): { g: Game; victim: InstanceId; mine: number } {
  const g = startedGame({
    players: 2,
    decks: [['Filigree Fracture'], ['Sol Ring', 'Baleful Strix']],
    scripts: createRegistry([FILIGREE_FRACTURE_SCRIPT]),
  });
  const victim = put(g, 'p2', name);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Filigree Fracture', 'hand');
  const mine = (g.state.zones.hand['p1'] ?? []).length - 1;
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim, mine };
}

describe('Filigree Fracture', () => {
  test('the colorless Ring dies and draws NOTHING', () => {
    const { g, victim, mine } = fractured('Sol Ring');
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mine);
  });

  test('the blue-black Strix dies and draws one', () => {
    const { g, victim, mine } = fractured('Baleful Strix');
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(mine + 1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FILIGREE_FRACTURE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FILIGREE_FRACTURE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FILIGREE_FRACTURE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = fractured('Sol Ring');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
