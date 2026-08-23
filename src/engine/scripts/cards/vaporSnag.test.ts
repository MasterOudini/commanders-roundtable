// `Vapor Snag` — the creature goes to its OWNER's hand and its CONTROLLER
// pays the life. Those are the same player here, and the comment in the
// module says why they are read separately.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { VAPOR_SNAG_SCRIPT } from './vaporSnag';
import { VAPOR_SNAG } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Vapor Snag';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function snagged(seat: 'p1' | 'p2'): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, BEARS], [BEARS]],
    scripts: createRegistry([VAPOR_SNAG_SCRIPT]),
  });
  const victim = put(g, seat, BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Vapor Snag', () => {
  test("an opponent's creature goes home and THEY pay 1", () => {
    const { g, victim } = snagged('p2');
    expect(g.state.cards[victim]?.zone.kind).toBe('hand');
    expect(g.state.cards[victim]?.zone.player).toBe('p2');
    expect(g.state.players.p2?.life).toBe(39);
    expect(g.state.players.p1?.life).toBe(40);
  });

  test('aimed at MY OWN creature, I pay the 1', () => {
    const { g, victim } = snagged('p1');
    expect(g.state.cards[victim]?.zone.kind).toBe('hand');
    expect(g.state.players.p1?.life).toBe(39);
    expect(g.state.players.p2?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = VAPOR_SNAG.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, VAPOR_SNAG.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(VAPOR_SNAG.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = snagged('p2');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
