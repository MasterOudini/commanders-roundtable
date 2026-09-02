// `Withering Torment` — the compound destroy plus a life bill on ME.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WITHERING_TORMENT_SCRIPT } from './witheringTorment';
import { WITHERING_TORMENT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Withering Torment';
const BEARS = 'Grizzly Bears';
const MANTRA = "Ajani's Mantra"; // a plain enchantment

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(victimName: string): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [victimName]],
    scripts: createRegistry([WITHERING_TORMENT_SCRIPT]),
  });
  const victim = put(g, 'p2', victimName);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Withering Torment', () => {
  test('a CREATURE dies and I pay 2', () => {
    const { g, victim } = cast(BEARS);
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(38);
    expect(g.state.players['p2']?.life).toBe(40);
  });

  test('the ENCHANTMENT half of the compound works too', () => {
    const { g, victim } = cast(MANTRA);
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(38);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WITHERING_TORMENT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WITHERING_TORMENT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WITHERING_TORMENT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast(BEARS);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
