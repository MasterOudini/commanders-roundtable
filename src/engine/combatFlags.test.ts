// D603 - TWO COMBAT FLAGS WITH AN END. `~ can attack this turn as though it didn't have defender.` (Wall of One Thousand Cuts,
// Hightide Hermit, Dark Maze - CR 702.3b's exception for a turn) and `Target creature can't block ~ this turn.` (Shrewd
// Hatchling, Screeching Griffin, Duct Crawler - a restriction on ONE pair, CR 509.1b). Both ride the until-end-of-turn entry
// D394's `cantBlock` rides (power 0 / toughness 0, cleared at cleanup): `attacksDespiteDefender` on the source, read by
// `canAttack`; `cantBlockCard` on the target, naming the source, read by `canBlock` for that pair only. What is proven: the
// vocabulary reads both; Steel Wall's declaration is refused without the flag and accepted with it; the blocker cannot block
// the named attacker and still blocks another; the hash.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const TEN = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];
const ATTACK = "~ can attack this turn as though it didn't have defender.";
const NO_BLOCK = "Target creature can't block ~ this turn.";

/** An upkeep head on `name` whose payload the vocabulary reads (the generated vocab shape). */
function head(name: string, payload: string): CardScript {
  const card = ORACLE.byName(name);
  if (!card) throw new Error(name + ' is not in the fixtures');
  const effects = vocabularyEffects(payload, name);
  const targets = vocabularyTargets(payload);
  return {
    oracleId: card.oracleId,
    name,
    triggers: [{
      abilityId: 'upkeep-0',
      text: card.faces[0]?.oracleText ?? '',
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => name + ' - ' + payload,
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets),
    }],
  };
}

function wallGame(withFlag: boolean): { g: Game; wall: string } {
  const g = startedGame({ players: 2, decks: [['Steel Wall', ...TEN], ['Grizzly Bears', ...TEN]], scripts: createRegistry(withFlag ? [head('Steel Wall', ATTACK)] : []) });
  settle(g);
  holdEverywhere(g);
  const wall = put(g, 'p1', 'Steel Wall');
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
  return { g, wall };
}

describe('D603 - two combat flags with an end', () => {
  test('the vocabulary reads both', () => {
    expect(vocabularyEffects(ATTACK, 'Wall of One Thousand Cuts').map((e) => [e.kind, e.self])).toEqual([['attackDespiteDefender', true]]);
    expect(vocabularyEffects(NO_BLOCK, 'Shrewd Hatchling').map((e) => [e.kind, e.targetIndex])).toEqual([['cantBlockSource', 0]]);
    expect(vocabularyTargets(NO_BLOCK)).toHaveLength(1);
  });

  test("a defender's declaration is refused without the flag", () => {
    const { g, wall } = wallGame(false);
    expect(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: wall, defender: { kind: 'player', id: 'p2' } }] }).ok).toBe(false);
  });

  test('and accepted with it (the upkeep trigger set it this turn)', () => {
    const { g, wall } = wallGame(true);
    expect(g.state.untilEndOfTurn.some((m) => m.card === wall && m.attacksDespiteDefender === true)).toBe(true);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: wall, defender: { kind: 'player', id: 'p2' } }] }));
    settle(g);
    expect(g.state.combat?.attackers.some((a) => a.card === wall)).toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a blocker named off one attacker cannot block it and still blocks another', () => {
    const g = startedGame({ players: 2, decks: [['Grizzly Bears', 'Raging Goblin', ...TEN], ['Steel Wall', ...TEN]], scripts: createRegistry([head('Grizzly Bears', NO_BLOCK)]) });
    settle(g);
    holdEverywhere(g);
    const bears = put(g, 'p1', 'Grizzly Bears');
    const goblin = put(g, 'p1', 'Raging Goblin');
    const wall = put(g, 'p2', 'Steel Wall');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: wall }] }));
    settle(g);
    expect(g.state.untilEndOfTurn.some((m) => m.card === wall && m.cantBlockCard === bears)).toBe(true);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'declareAttackers', 20_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: bears, defender: { kind: 'player', id: 'p2' } }, { card: goblin, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'declareBlockers', 20_000);
    expect(g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: [{ blocker: wall, attacker: bears }] }).ok, 'not the named attacker').toBe(false);
    must(g.submit({ t: 'DeclareBlockers', player: 'p2', blocks: [{ blocker: wall, attacker: goblin }] }));
    settle(g);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
