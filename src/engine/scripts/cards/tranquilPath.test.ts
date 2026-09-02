// `Tranquil Path` — every enchantment on the board goes to its owner's
// graveyard, mine included; creatures stay; I draw either way.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TRANQUIL_PATH_SCRIPT } from './tranquilPath';
import { TRANQUIL_PATH } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Tranquil Path';
const SEASON = 'Season of Growth';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawsFor(g: Game, player: string, from: number): number {
  let n = 0;
  for (const e of g.log.slice(from)) {
    if (e.body.t !== 'CardsMoved') continue;
    n += e.body.moves.filter((m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player).length;
  }
  return n;
}

function cast(withEnchantments: boolean): { g: Game; mine: InstanceId | null; theirs: InstanceId | null; bears: InstanceId; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, SEASON], [SEASON, BEARS]],
    scripts: createRegistry([TRANQUIL_PATH_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  const bears = put(g, 'p2', BEARS);
  const mine = withEnchantments ? put(g, 'p1', SEASON) : null;
  const theirs = withEnchantments ? put(g, 'p2', SEASON) : null;
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs, bears, logAt };
}

describe('Tranquil Path', () => {
  test('both enchantments die, the bear lives, and I draw', () => {
    const { g, mine, theirs, bears, logAt } = cast(true);
    expect(g.state.cards[mine as InstanceId]?.zone).toEqual({ kind: 'graveyard', player: 'p1' });
    expect(g.state.cards[theirs as InstanceId]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('no enchantments: just the card', () => {
    const { g, bears, logAt } = cast(false);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TRANQUIL_PATH.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TRANQUIL_PATH.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TRANQUIL_PATH.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
