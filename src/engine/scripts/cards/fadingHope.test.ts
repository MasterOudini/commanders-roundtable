// `Fading Hope` — the MV-2 bounce asks the scry; the MV-6 bounce asks
// nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FADING_HOPE_SCRIPT } from './fadingHope';
import { FADING_HOPE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function faded(name: 'Grizzly Bears' | 'Colossal Dreadmaw'): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Fading Hope'], ['Grizzly Bears', 'Colossal Dreadmaw']],
    scripts: createRegistry([FADING_HOPE_SCRIPT]),
  });
  const victim = put(g, 'p2', name);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Fading Hope', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  return { g, victim };
}

describe('Fading Hope', () => {
  test('the MV-2 bounce raises the scry; answering clears it', () => {
    const { g, victim } = faded('Grizzly Bears');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    expect(g.state.cards[victim]?.zone.kind).toBe('hand');
    const lib = g.state.zones.library['p1'] ?? [];
    const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
    expect(revealed).toHaveLength(1);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    expect(g.state.priority.awaiting).toBeNull();
  });

  test('the MV-6 bounce asks nothing', () => {
    const { g, victim } = faded('Colossal Dreadmaw');
    settle(g);
    expect(g.state.cards[victim]?.zone.kind).toBe('hand');
    expect(g.state.priority.awaiting).toBeNull();
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FADING_HOPE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FADING_HOPE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FADING_HOPE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = faded('Colossal Dreadmaw');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
