// `Blight Grenade` — the target dies to the destroy, a second 2/2 dies to
// the -3/-3, a 6/6 is 3/3 until cleanup.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BLIGHT_GRENADE_SCRIPT } from './blightGrenade';
import { BLIGHT_GRENADE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Blight Grenade';
const TITAN = 'Grave Titan'; // 6/6
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function thrown(): { g: Game; titan: InstanceId; target: InstanceId; bystander: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, TITAN], [BEARS, BEARS]],
    scripts: createRegistry([BLIGHT_GRENADE_SCRIPT]),
  });
  const titan = put(g, 'p1', TITAN);
  const target = put(g, 'p2', BEARS);
  const bystander = put(g, 'p2', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
  settle(g);
  return { g, titan, target, bystander };
}

function pt(g: Game, id: InstanceId): { power: number | null; toughness: number | null } {
  const d = deps(createRegistry([BLIGHT_GRENADE_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return { power: got.power, toughness: got.toughness };
}

describe('Blight Grenade', () => {
  test('the target is destroyed, the bystander 2/2 dies to -3/-3, the 6/6 is 3/3', () => {
    const { g, titan, target, bystander } = thrown();
    expect(g.state.cards[target]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bystander]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[titan]?.zone.kind).toBe('battlefield');
    expect(pt(g, titan)).toEqual({ power: 3, toughness: 3 });
  });

  test('cleanup gives the 6/6 back (CR 514.2)', () => {
    const { g, titan } = thrown();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(pt(g, titan)).toEqual({ power: 6, toughness: 6 });
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BLIGHT_GRENADE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BLIGHT_GRENADE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BLIGHT_GRENADE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = thrown();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
