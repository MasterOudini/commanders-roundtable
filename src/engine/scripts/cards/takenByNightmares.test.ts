// `Taken by Nightmares` — the exile always; the scry only behind an
// enchantment I control, and the ask is emitted LAST (D195).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TAKEN_BY_NIGHTMARES_SCRIPT } from './takenByNightmares';
import { TAKEN_BY_NIGHTMARES } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Taken by Nightmares';
const MANTRA = "Ajani's Mantra";
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(withEnchantment: boolean): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, MANTRA], [BEARS]],
    scripts: createRegistry([TAKEN_BY_NIGHTMARES_SCRIPT]),
  });
  if (withEnchantment) put(g, 'p1', MANTRA);
  const victim = put(g, 'p2', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  return { g, victim };
}

describe('Taken by Nightmares', () => {
  test('with an enchantment out: exiled, then the scry asks for TWO', () => {
    const { g, victim } = cast(true);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    expect(g.state.cards[victim]?.zone.kind).toBe('exile');
    const lib = g.state.zones.library['p1'] ?? [];
    const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
    expect(revealed).toHaveLength(2);
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: revealed, toBottom: [] }));
    settle(g);
    expect(g.state.priority.awaiting).toBeNull();
  });

  test('with NO enchantment: exiled, no ask at all', () => {
    const { g, victim } = cast(false);
    settle(g);
    expect(g.state.cards[victim]?.zone.kind).toBe('exile');
    expect(g.state.priority.awaiting).toBeNull();
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TAKEN_BY_NIGHTMARES.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TAKEN_BY_NIGHTMARES.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TAKEN_BY_NIGHTMARES.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast(true);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
    const lib = g.state.zones.library['p1'] ?? [];
    const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1')) as InstanceId[];
    must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [], toBottom: revealed }));
    settle(g);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
