// D438 - THE BLOCK COUNTS: CR 509.1a's one attacker per blocker (never checked before), lifted by `can block an
// additional creature each combat` / `can block any number of creatures` (`blockCapacity`); `can't be blocked by more
// than one creature` (`maxBlockers`); `can't be blocked except by three or more creatures` (`minBlockers` - menace's
// rule generalised). Three CombatDef questions, answered over the whole declaration.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

/** A combat def on a fixture creature: the hook answers for the creature itself, `null` for every other. */
function script(name: string, def: Partial<CardScript['combat'] extends readonly (infer D)[] | undefined ? D : never>): CardScript {
  const card = ORACLE.byName(name);
  if (!card) throw new Error(name + ' is not in the fixtures');
  return { oracleId: card.oracleId, name, combat: [{ abilityId: 'count-0', text: card.faces[0]?.oracleText ?? '', activeZones: ['battlefield'], ...def }] };
}
const TEN = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];
/** p1 holds the scripted creature and Bears; p2 holds three blockers. p1 attacks on turn 3, p2 blocks. */
function armed(s: CardScript | null, p1: readonly string[], p2: readonly string[]): { g: Game; mine: InstanceId[]; theirs: InstanceId[] } {
  const g = startedGame({ players: 2, decks: [[...p1, ...TEN], [...p2, ...TEN]], scripts: createRegistry(s ? [s] : []) });
  advanceUntil(g, (x) => x.stack.length === 0 && x.pendingTriggers.length === 0 && x.priority.awaiting === null, 20_000);
  holdEverywhere(g);
  const mine = p1.map((n) => put(g, 'p1', n));
  const theirs = p2.map((n) => put(g, 'p2', n));
  advanceUntil(g, (x) => x.turn.turnNumber === 3 && x.priority.awaiting?.kind === 'declareAttackers', 20_000);
  return { g, mine, theirs };
}
function attackWith(g: Game, cards: readonly InstanceId[]): void {
  must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: cards.map((card) => ({ card, defender: { kind: 'player', id: 'p2' } })) }));
  advanceUntil(g, (x) => x.priority.awaiting?.kind === 'declareBlockers', 20_000);
  expect(g.state.priority.awaiting?.kind).toBe('declareBlockers');
}
const blocks = (pairs: readonly [InstanceId, InstanceId][]) => pairs.map(([blocker, attacker]) => ({ blocker, attacker }));

describe('the block counts (D438)', () => {
  test('CR 509.1a: a creature blocks one attacker, and a def lifts it to two or to any number', () => {
    const { g, mine, theirs } = armed(null, ['Grizzly Bears', 'Raging Goblin'], ['Walking Corpse']);
    attackWith(g, mine);
    const [bears, goblin] = mine as [InstanceId, InstanceId];
    const corpse = theirs[0] as InstanceId;
    const two = g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: blocks([[corpse, bears], [corpse, goblin]]) });
    expect(two.ok).toBe(false);
    expect(two.ok ? '' : two.message).toContain('only one creature');
    must(g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: blocks([[corpse, bears]]) }));
  });

  test('`can block an additional creature each combat` blocks two, not three', () => {
    const wall = script('Walking Corpse', { blockCapacity: (_ctx, self, blocker) => (blocker === self ? 2 : null) });
    const { g, mine, theirs } = armed(wall, ['Grizzly Bears', 'Raging Goblin', 'Coral Eel'], ['Walking Corpse']);
    attackWith(g, mine);
    const corpse = theirs[0] as InstanceId;
    const three = g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: blocks(mine.map((a) => [corpse, a] as [InstanceId, InstanceId])) });
    expect(three.ok).toBe(false);
    expect(three.ok ? '' : three.message).toContain('up to 2');
    must(g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: blocks([[corpse, mine[0] as InstanceId], [corpse, mine[1] as InstanceId]]) }));
    expect(g.state.combat?.blockers.find((b) => b.card === corpse)?.attackerOrder).toHaveLength(2);
  });

  test('`can block any number of creatures` blocks three', () => {
    const wall = script('Walking Corpse', { blockCapacity: (_ctx, self, blocker) => (blocker === self ? Infinity : null) });
    const { g, mine, theirs } = armed(wall, ['Grizzly Bears', 'Raging Goblin', 'Coral Eel'], ['Walking Corpse']);
    attackWith(g, mine);
    const corpse = theirs[0] as InstanceId;
    must(g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: blocks(mine.map((a) => [corpse, a] as [InstanceId, InstanceId])) }));
    expect(g.state.combat?.blockers.find((b) => b.card === corpse)?.attackerOrder).toHaveLength(3);
  });

  test("`can't be blocked by more than one creature`: two blockers refused, one accepted", () => {
    const rhino = script('Grizzly Bears', { maxBlockers: (_ctx, self, attacker) => (attacker === self ? 1 : null) });
    const { g, mine, theirs } = armed(rhino, ['Grizzly Bears'], ['Walking Corpse', 'Coral Eel']);
    attackWith(g, mine);
    const bears = mine[0] as InstanceId;
    const two = g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: blocks(theirs.map((b) => [b, bears] as [InstanceId, InstanceId])) });
    expect(two.ok).toBe(false);
    expect(two.ok ? '' : two.message).toContain('more than one');
    must(g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: blocks([[theirs[0] as InstanceId, bears]]) }));
  });

  test("`can't be blocked except by three or more creatures`: two refused, three accepted; the replay hash", () => {
    const troll = script('Grizzly Bears', { minBlockers: (_ctx, self, attacker) => (attacker === self ? 3 : null) });
    const { g, mine, theirs } = armed(troll, ['Grizzly Bears'], ['Walking Corpse', 'Coral Eel', 'Raging Goblin']);
    attackWith(g, mine);
    const bears = mine[0] as InstanceId;
    const two = g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: blocks(theirs.slice(0, 2).map((b) => [b, bears] as [InstanceId, InstanceId])) });
    expect(two.ok).toBe(false);
    expect(two.ok ? '' : two.message).toContain('3 or more');
    must(g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: blocks(theirs.map((b) => [b, bears] as [InstanceId, InstanceId])) }));
    advanceUntil(g, (x) => x.turn.turnNumber >= 4, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
