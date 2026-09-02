// `Aragorn, the Uniter` — a white spell makes a Human Soldier, a red spell
// aims 3 at the opponent, a green spell aims +4/+4 at a creature, a blue
// spell scries 2, and a white-and-blue spell fires both of its lines.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ARAGORN_THE_UNITER_SCRIPT } from './aragornTheUniter';
import { TOPPLE_THE_STATUE_SCRIPT } from './toppleTheStatue';
import { SORCEROUS_SIGHT_SCRIPT } from './sorcerousSight';
import { STENSIA_BANQUET_SCRIPT } from './stensiaBanquet';
import { TRANQUIL_PATH_SCRIPT } from './tranquilPath';
import { SPHINXS_INSIGHT_SCRIPT } from './sphinxsInsight';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const ARAGORN = 'Aragorn, the Uniter';
const BEARS = 'Grizzly Bears';
const TOPPLE = 'Topple the Statue';
const SIGHT = 'Sorcerous Sight';
const BANQUET = 'Stensia Banquet';
const PATH = 'Tranquil Path';
const INSIGHT = "Sphinx's Insight";
const SOLDIER = TOKEN_TABLE['Human Soldier|1/1|W|Creature|'];

const SCRIPTS = [
  ARAGORN_THE_UNITER_SCRIPT,
  TOPPLE_THE_STATUE_SCRIPT,
  SORCEROUS_SIGHT_SCRIPT,
  STENSIA_BANQUET_SCRIPT,
  TRANQUIL_PATH_SCRIPT,
  SPHINXS_INSIGHT_SCRIPT,
];

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function pt(g: Game, id: InstanceId): { power: number | null; toughness: number | null } {
  const d = deps(createRegistry(SCRIPTS));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return { power: got.power, toughness: got.toughness };
}

function soldiers(g: Game, player: string): number {
  return g.state.zones.battlefield.filter((id) => {
    const c = g.state.cards[id];
    return !!c && c.isToken && c.controller === player && c.printingId === SOLDIER?.printingId;
  }).length;
}

function drawsFor(g: Game, player: string, from: number): number {
  let n = 0;
  for (const e of g.log.slice(from)) {
    if (e.body.t !== 'CardsMoved') continue;
    n += e.body.moves.filter((m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player).length;
  }
  return n;
}

function answerScry(g: Game): number {
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'scryChoice', 20_000);
  const lib = g.state.zones.library['p1'] ?? [];
  const revealed = lib.filter((id) => g.state.cards[id]?.revealedTo.includes('p1'));
  must(g.submit({ t: 'AnswerScry', player: 'p1', toTop: [...revealed], toBottom: [] }));
  return revealed.length;
}

function united(): { g: Game; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[ARAGORN, BEARS, TOPPLE, SIGHT, BANQUET, PATH, INSIGHT], [BEARS]],
    scripts: createRegistry(SCRIPTS),
  });
  settle(g);
  holdEverywhere(g);
  const theirs = put(g, 'p2', BEARS);
  const mine = put(g, 'p1', BEARS);
  put(g, 'p1', ARAGORN);
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 60_000);
  return { g, mine, theirs };
}

type Sym = 'W' | 'U' | 'B' | 'R' | 'G' | 'C';

function mana(g: Game, pairs: [Sym, number][]): void {
  for (const [symbol, amount] of pairs) must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol, amount }));
}

describe('Aragorn, the Uniter', () => {
  test('a white spell makes a Human Soldier', () => {
    const { g, theirs } = united();
    const spell = put(g, 'p1', TOPPLE, 'hand');
    mana(g, [['W', 1], ['C', 2]]);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: theirs }] }));
    settle(g);
    expect(soldiers(g, 'p1')).toBe(1);
    expect(g.state.cards[theirs]?.tapped).toBe(true);
  });

  test('a red spell aims 3 damage at the opponent', () => {
    const { g } = united();
    const spell = put(g, 'p1', BANQUET, 'hand');
    mana(g, [['R', 1], ['C', 2]]);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(g.state.players['p2']?.life).toBe(37);
    expect(soldiers(g, 'p1')).toBe(0);
  });

  test('a green spell aims +4/+4 at a creature until cleanup', () => {
    const { g, mine } = united();
    const spell = put(g, 'p1', PATH, 'hand');
    mana(g, [['G', 1], ['C', 4]]);
    const logAt = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mine }] }));
    settle(g);
    expect(pt(g, mine)).toEqual({ power: 6, toughness: 6 });
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(pt(g, mine)).toEqual({ power: 2, toughness: 2 });
  });

  test('a blue spell scries 2', () => {
    const { g } = united();
    const spell = put(g, 'p1', SIGHT, 'hand');
    mana(g, [['U', 1]]);
    const logAt = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    expect(answerScry(g)).toBe(2);
    settle(g);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
    expect(soldiers(g, 'p1')).toBe(0);
  });

  test('a white-and-blue spell fires both lines', () => {
    const { g } = united();
    const spell = put(g, 'p1', INSIGHT, 'hand');
    mana(g, [['W', 1], ['U', 1], ['C', 2]]);
    const logAt = g.log.length;
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
    expect(answerScry(g)).toBe(2);
    settle(g);
    expect(soldiers(g, 'p1')).toBe(1);
    expect(drawsFor(g, 'p1', logAt)).toBe(2);
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('replays to the same hash', () => {
    const { g } = united();
    const spell = put(g, 'p1', INSIGHT, 'hand');
    mana(g, [['W', 1], ['U', 1], ['C', 2]]);
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
    answerScry(g);
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
