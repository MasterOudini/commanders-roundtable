// `Prizefight` — my 2/2 and their 6/6 trade blows (mine dies, theirs is
// marked 2), and a Treasure arrives.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { PRIZEFIGHT_SCRIPT } from './prizefight';
import { PRIZEFIGHT } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Prizefight';
const BEARS = 'Grizzly Bears';
const TITAN = 'Grave Titan';
const TREASURE = TOKEN_TABLE['Treasure|/||Artifact|'];

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function treasuresOf(g: Game, player: string): number {
  return g.state.zones.battlefield.filter((id) => {
    const c = g.state.cards[id];
    return !!c && c.isToken && c.controller === player && c.printingId === TREASURE?.printingId;
  }).length;
}

function fought(): { g: Game; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, BEARS], [TITAN]],
    scripts: createRegistry([PRIZEFIGHT_SCRIPT]),
  });
  const mine = put(g, 'p1', BEARS);
  const theirs = put(g, 'p2', TITAN);
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

describe('Prizefight', () => {
  test('the fight: mine dies to 6, theirs is marked 2, and I get a Treasure', () => {
    const { g, mine, theirs } = fought();
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[theirs]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[theirs]?.damage).toBe(2);
    expect(treasuresOf(g, 'p1')).toBe(1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = PRIZEFIGHT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, PRIZEFIGHT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(PRIZEFIGHT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = fought();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
