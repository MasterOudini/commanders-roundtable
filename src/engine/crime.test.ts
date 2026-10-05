// D629 - COMMIT A CRIME (CR 700.13). A player commits a crime as they cast a spell, activate an ability or put a triggered
// ability on the stack that targets an opponent, a permanent or a spell or ability an opponent controls, or a card in an
// opponent's graveyard - one crime per object. What is proven: the parse (`you've committed a crime this turn` is the closed
// reader's turn-memory question, in an activation and a gate); a spell at an opponent, at an opponent's creature and at a
// card in an opponent's graveyard commits one, at your own creature or your own graveyard none; an activation at an opponent; a
// triggered ability's target as it is chosen; the turn record and the condition over it, cleared at the next turn; the
// replay hash.
import { describe, expect, test } from 'vitest';
import { parseActivationConditions, parseGateCondition } from '../data/activatedParse';
import { activationConditionsHold } from './activationConditions';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, clearSickness, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { Game } from './game';
import type { InstanceId, PlayerId } from './types/ids';

const BOLT = 'Lightning Bolt';
const BEARS = 'Grizzly Bears';
const settle = (g: Game) => advanceUntil(g, (s) => s.priority.awaiting === null && s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
const main = (g: Game) => advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 60_000);
const crimes = (g: Game, from = 0) => g.log.slice(from).filter((e) => e.body.t === 'CrimeCommitted').map((e) => (e.body as { player: PlayerId }).player);

function table(scripts: readonly CardScript[] = []): Game {
  const g = startedGame({ players: 2, decks: [[BOLT, BOLT, BOLT, 'Reanimate', 'Reanimate', 'Prodigal Sorcerer', BEARS, BEARS], [BEARS, BEARS, 'Forest']], scripts: createRegistry([...scripts]) });
  holdEverywhere(g);
  main(g);
  return g;
}
function bolt(g: Game, target: { kind: 'player'; id: PlayerId } | { kind: 'card'; id: InstanceId }): number {
  const at = g.log.length;
  const card = put(g, 'p1', BOLT, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card, targets: [target] }));
  settle(g);
  return at;
}

// A test-only enters trigger with a TARGET (payMana.test.ts's stamp): the crime is committed as its target is chosen.
const PING = 'test-crime-ping';
const PAYLOAD = '~ deals 1 damage to target player.';
const PINGER: CardScript = {
  oracleId: PING,
  name: 'Testing Ping',
  triggers: [
    {
      abilityId: 'a0',
      text: 'When this creature enters, it deals 1 damage to target player.',
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: vocabularyTargets(PAYLOAD),
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield'),
      label: () => 'Testing Ping',
      resolve: (ctx, _self, obj) => ctx.vocabulary(obj, vocabularyEffects(PAYLOAD, 'Testing Ping'), vocabularyTargets(PAYLOAD)),
    },
  ],
};

describe('D629 - commit a crime', () => {
  test("the parse: `you've committed a crime this turn` is the closed reader's turn-memory question", () => {
    expect(parseActivationConditions("Activate only if you've committed a crime this turn.").conditions).toEqual([{ kind: 'turnMemory', what: 'crimes', who: 'you', count: 1, any: null, none: null }]);
    expect(parseGateCondition("you've committed a crime this turn")).toMatchObject({ kind: 'turnMemory', what: 'crimes', who: 'you', count: 1 });
  });

  test("a spell at an opponent, an opponent's creature or a card in an opponent's graveyard is a crime; at your own, none", () => {
    const g = table();
    const mine = put(g, 'p1', BEARS);
    const theirs = put(g, 'p2', BEARS);
    settle(g);
    expect(crimes(g, bolt(g, { kind: 'card', id: mine })), 'your own creature').toEqual([]);
    expect(g.state.turn.memory.crimes, 'no record before the first').toBeUndefined();
    expect(crimes(g, bolt(g, { kind: 'player', id: 'p2' })), 'an opponent').toEqual(['p1']);
    expect(crimes(g, bolt(g, { kind: 'card', id: theirs })), "an opponent's creature").toEqual(['p1']);
    expect(g.state.turn.memory.crimes?.p1).toBe(2);
    // Reanimate a creature card from a graveyard: an opponent's is a crime, your own is not.
    const ownDead = put(g, 'p1', BEARS, 'graveyard');
    const theirDead = put(g, 'p2', BEARS, 'graveyard');
    for (const [target, want] of [[ownDead, []], [theirDead, ['p1']]] as const) {
      const at = g.log.length;
      const card = put(g, 'p1', 'Reanimate', 'hand');
      must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
      must(g.submit({ t: 'CastSpell', player: 'p1', card, targets: [{ kind: 'card', id: target }] }));
      settle(g);
      expect(crimes(g, at)).toEqual(want);
    }
    expect(g.state.turn.memory.crimes?.p1).toBe(3);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('an activation aimed at an opponent is a crime', () => {
    const g = table();
    const sorcerer = put(g, 'p1', 'Prodigal Sorcerer');
    settle(g);
    clearSickness(g);
    main(g);
    const at = g.log.length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: sorcerer, abilityIndex: 0 }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: 'p2' }] }));
    settle(g);
    expect(crimes(g, at)).toEqual(['p1']);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test("a triggered ability's target: a crime as it is chosen at an opponent, none at yourself", () => {
    for (const [who, want] of [['p2', ['p1']], ['p1', []]] as const) {
      const g = table([PINGER]);
      const at = g.log.length;
      const id = put(g, 'p1', BEARS, 'hand');
      const inst = g.state.cards[id];
      if (inst) (inst as { oracleId: string }).oracleId = PING;
      must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'battlefield', player: 'p1' } }));
      advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
      must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'player', id: who }] }));
      settle(g);
      expect(crimes(g, at), 'aimed at ' + who).toEqual(want);
    }
  });

  test('the condition reads the turn record, and the record is cleared at the next turn', () => {
    const g = table();
    const cond = parseActivationConditions("Activate only if you've committed a crime this turn.").conditions;
    const anchor = put(g, 'p1', BEARS);
    settle(g);
    const holds = () => activationConditionsHold(g.state, g.deps.oracle, g.deps.scripts, 'p1', anchor, cond);
    expect(holds(), 'no crime yet').toBe(false);
    bolt(g, { kind: 'player', id: 'p2' });
    expect(holds(), 'after the crime').toBe(true);
    expect(activationConditionsHold(g.state, g.deps.oracle, g.deps.scripts, 'p2', anchor, cond), "an opponent's crime is not yours").toBe(false);
    advanceUntil(g, (s) => s.turn.activePlayer === 'p2' && s.turn.phase === 'precombatMain', 60_000);
    expect(g.state.turn.memory.crimes).toBeUndefined();
    expect(holds(), 'a new turn').toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
