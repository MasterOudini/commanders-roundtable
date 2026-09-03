// `Bionic Blow` — X = 2: my bear gets +2/+0 and deals its 4 power to
// their bear, which dies; with no second target only the pump.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BIONIC_BLOW_SCRIPT } from './bionicBlow';
import { BIONIC_BLOW } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Bionic Blow';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): { power: number | null; toughness: number | null } {
  const d = deps(createRegistry([BIONIC_BLOW_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return { power: got.power, toughness: got.toughness };
}

function aimed(): { g: Game; mine: InstanceId; theirs: InstanceId; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, BEARS], [BEARS]],
    scripts: createRegistry([BIONIC_BLOW_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  const mine = put(g, 'p1', BEARS);
  const theirs = put(g, 'p2', BEARS);
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: 2 }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  return { g, mine, theirs, logAt };
}

describe('Bionic Blow (X = 2)', () => {
  test('my bear gets +2/+0 and deals 4 to their bear, which dies', () => {
    const { g, mine, theirs } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mine }, { kind: 'card', id: theirs }] }));
    settle(g);
    expect(pt(g, mine)).toEqual({ power: 4, toughness: 2 });
    expect(g.state.cards[theirs]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
  });

  test('only my creature: the pump alone', () => {
    const { g, mine, theirs, logAt } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mine }] }));
    settle(g);
    expect(g.log.slice(logAt).some((e) => e.body.t === 'SpellFizzled')).toBe(false);
    expect(pt(g, mine)).toEqual({ power: 4, toughness: 2 });
    expect(g.state.cards[theirs]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BIONIC_BLOW.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BIONIC_BLOW.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BIONIC_BLOW.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g, mine, theirs } = aimed();
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mine }, { kind: 'card', id: theirs }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
