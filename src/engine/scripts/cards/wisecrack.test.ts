// `Wisecrack` — the self-damage always, and the 2 to the controller ONLY
// when that creature is attacking. Outside combat there is no `combat` at
// all, so the rider must not fire — that is the branch a happy-path test
// would miss.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WISECRACK_SCRIPT } from './wisecrack';
import { WISECRACK } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Wisecrack';
const TITAN = 'Grave Titan'; // 6/6 — 6 to itself is lethal, so damage reads before SBA

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

/** Cast at a creature sitting quietly on p2's board — never attacking. */
function castOutOfCombat(): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [TITAN]],
    scripts: createRegistry([WISECRACK_SCRIPT]),
  });
  const victim = put(g, 'p2', TITAN);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

/** p2 attacks with the Titan; I cast in the blockers step and hold priority. */
function castAtAnAttacker(): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [TITAN]],
    scripts: createRegistry([WISECRACK_SCRIPT]),
  });
  const victim = put(g, 'p2', TITAN);
  settle(g);
  holdEverywhere(g);
  advanceUntil(
    g,
    (s) =>
      s.turn.turnNumber >= 2 &&
      s.turn.activePlayer === 'p2' &&
      s.priority.awaiting?.kind === 'declareAttackers',
    120_000,
  );
  must(
    g.submit({
      t: 'DeclareAttackers',
      player: 'p2',
      attackers: [{ card: victim, defender: { kind: 'player', id: 'p1' } }],
    }),
  );
  // ⚠️ D232's trap: a defender with NO creatures is never asked to block, so
  // waiting for a declareBlockers ask would run the budget out and play the
  // game to its END underneath the test (the first cut hit `gameOver` here).
  // p1 already receives priority in the declare-attackers step, with the
  // Titan attacking — cast there.
  advanceUntil(g, (s) => s.priority.player === 'p1' && (s.combat?.attackers.length ?? 0) > 0, 20_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Wisecrack', () => {
  test('out of combat: it kills itself and the controller pays NOTHING', () => {
    const { g, victim } = castOutOfCombat();
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(40);
  });

  test('ATTACKING: the same self-damage, plus 2 to its controller', () => {
    const { g, victim } = castAtAnAttacker();
    expect(g.state.cards[victim]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WISECRACK.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WISECRACK.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WISECRACK.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = castOutOfCombat();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
