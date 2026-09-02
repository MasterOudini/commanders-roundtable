// `Shamanic Revelation` — three creatures are three cards; the one at power
// 4 or more is 4 life; with only small creatures, cards and no life.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { SHAMANIC_REVELATION_SCRIPT } from './shamanicRevelation';
import { SHAMANIC_REVELATION } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const SPELL = 'Shamanic Revelation';
const BEARS = 'Grizzly Bears'; // 2/2
const TITAN = 'Grave Titan'; // 6/6
const WIZARD = 'Zuran Spellcaster'; // 1/1

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

function revealed(creatures: readonly string[]): { g: Game; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, ...creatures], []],
    scripts: createRegistry([SHAMANIC_REVELATION_SCRIPT]),
  });
  for (const name of creatures) put(g, 'p1', name);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, logAt };
}

describe('Shamanic Revelation', () => {
  test('three creatures, one of them big: three cards and 4 life', () => {
    const { g, logAt } = revealed([BEARS, TITAN, WIZARD]);
    expect(drawsFor(g, 'p1', logAt)).toBe(3);
    expect(g.state.players['p1']?.life).toBe(44);
  });

  test('two small creatures: two cards, no life', () => {
    const { g, logAt } = revealed([BEARS, WIZARD]);
    expect(drawsFor(g, 'p1', logAt)).toBe(2);
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = SHAMANIC_REVELATION.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, SHAMANIC_REVELATION.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(SHAMANIC_REVELATION.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = revealed([BEARS, TITAN, WIZARD]);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
