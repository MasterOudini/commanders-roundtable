// `Consuming Ashes` — the exile always; the surveil only when the victim
// HAD mana value 3 or less.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CONSUMING_ASHES_SCRIPT } from './consumingAshes';
import { CONSUMING_ASHES } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function burned(name: 'Grizzly Bears' | 'Colossal Dreadmaw'): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Consuming Ashes'], ['Grizzly Bears', 'Colossal Dreadmaw']],
    scripts: createRegistry([CONSUMING_ASHES_SCRIPT]),
  });
  const victim = put(g, 'p2', name);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Consuming Ashes', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  return { g, victim };
}

describe('Consuming Ashes', () => {
  test('a CHEAP victim: exiled, then the surveil asks', () => {
    const { g, victim } = burned('Grizzly Bears');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    expect(g.state.cards[victim]?.zone.kind).toBe('exile');
    const lib = g.state.zones.library['p1'] ?? [];
    const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
    expect(revealed).toHaveLength(2);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    expect(g.state.priority.awaiting).toBeNull();
  });

  test('an EXPENSIVE victim: exiled, no ask', () => {
    const { g, victim } = burned('Colossal Dreadmaw');
    settle(g);
    expect(g.state.cards[victim]?.zone.kind).toBe('exile');
    expect(g.state.priority.awaiting).toBeNull();
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CONSUMING_ASHES.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CONSUMING_ASHES.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CONSUMING_ASHES.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = burned('Grizzly Bears');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    const lib = g.state.zones.library['p1'] ?? [];
    const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1')) as InstanceId[];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
    settle(g);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
