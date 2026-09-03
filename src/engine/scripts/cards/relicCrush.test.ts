// `Relic Crush` — their artifact and my enchantment are both destroyed; a
// single target is a legal cast.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { RELIC_CRUSH_SCRIPT } from './relicCrush';
import { RELIC_CRUSH } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Relic Crush';
const STAFF = 'Staff of Nin';
const SEASON = 'Season of Growth';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function aimed(): { g: Game; staff: InstanceId; season: InstanceId; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, SEASON], [STAFF]],
    scripts: createRegistry([RELIC_CRUSH_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  const staff = put(g, 'p2', STAFF);
  const season = put(g, 'p1', SEASON);
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, staff, season, logAt };
}

describe('Relic Crush (a target and up to one other)', () => {
  test('two targets: both destroyed', () => {
    const { g, staff, season } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: staff }, { kind: 'card', id: season }] }));
    settle(g);
    expect(g.state.cards[staff]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
    expect(g.state.cards[season]?.zone).toEqual({ kind: 'graveyard', player: 'p1' });
  });

  test('one target: a legal cast, one destroyed', () => {
    const { g, staff, season, logAt } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: staff }] }));
    settle(g);
    expect(g.log.slice(logAt).some((e) => e.body.t === 'SpellFizzled')).toBe(false);
    expect(g.state.cards[staff]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[season]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = RELIC_CRUSH.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, RELIC_CRUSH.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(RELIC_CRUSH.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g, staff, season } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: staff }, { kind: 'card', id: season }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
