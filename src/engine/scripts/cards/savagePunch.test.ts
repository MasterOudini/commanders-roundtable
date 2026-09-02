// `Savage Punch` — two 2/2s trade without Ferocious; with a 6/6 of mine on
// the board my 2/2 is pumped to 4/4 first and wins the fight.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { SAVAGE_PUNCH_SCRIPT } from './savagePunch';
import { SAVAGE_PUNCH } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Savage Punch';
const BEARS = 'Grizzly Bears';
const TITAN = 'Grave Titan';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function punched(ferocious: boolean): { g: Game; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, BEARS, TITAN], [BEARS]],
    scripts: createRegistry([SAVAGE_PUNCH_SCRIPT]),
  });
  const mine = put(g, 'p1', BEARS);
  if (ferocious) put(g, 'p1', TITAN);
  const theirs = put(g, 'p2', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'card', id: mine },
        { kind: 'card', id: theirs },
      ],
    }),
  );
  settle(g);
  return { g, mine, theirs };
}

function pt(g: Game, id: InstanceId): { power: number | null; toughness: number | null } {
  const d = deps(createRegistry([SAVAGE_PUNCH_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return { power: got.power, toughness: got.toughness };
}

describe('Savage Punch', () => {
  test('without Ferocious the two 2/2s trade', () => {
    const { g, mine, theirs } = punched(false);
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
  });

  test('with a 6/6 of mine around, my 2/2 is 4/4 before it fights and wins', () => {
    const { g, mine, theirs } = punched(true);
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mine]?.zone.kind).toBe('battlefield');
    expect(pt(g, mine)).toEqual({ power: 4, toughness: 4 });
    expect(g.state.cards[mine]?.damage).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = SAVAGE_PUNCH.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, SAVAGE_PUNCH.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(SAVAGE_PUNCH.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = punched(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
