// D613 - THE ACTIVATION'S X. An activated ability whose cost prints `{X}` (CR 107.3, 602.2b: activating follows casting's
// steps - the X is announced before the targets and the costs): `{X}, {T}: You gain X life.` (Oracle of Nectars), `{X}{R}:
// It deals X damage to any target.`. The intent may name it inline (`ActivateAbility.xValue`) or the host asks (`chooseX`,
// the spell's prompt, now for an ability's pending activation too); the payment is priced at the announced X, and the X
// rides the stack object (`StackObject.xValue`) for the vocabulary's `spellX` count, read through `vocabularyEffects`'
// `xCost` option. What is proven: the vocabulary reads the X only when told the cost carries one; an inline X of three
// gains three; an asked X of two gains two and taps the source; a negative X is refused; the hashes.
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
const ORACLE_OF_NECTARS = 'Oracle of Nectars';
const PAYLOAD = 'You gain X life.';

/** Oracle of Nectars' printed `{X}, {T}:` activation, resolving the payload through the vocabulary with the X read. */
function nectars(): CardScript {
  const card = ORACLE.byName(ORACLE_OF_NECTARS);
  if (!card) throw new Error('Oracle of Nectars is not in the fixtures');
  const effects = vocabularyEffects(PAYLOAD, ORACLE_OF_NECTARS, { xCost: true });
  const targets = vocabularyTargets(PAYLOAD);
  return {
    oracleId: card.oracleId,
    name: ORACLE_OF_NECTARS,
    activated: [{
      ref: card.oracleId + '#a0',
      text: card.faces[0]?.oracleText ?? '',
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets),
    }],
  };
}

function armed(): { g: Game; id: string } {
  const g = startedGame({ players: 2, decks: [[ORACLE_OF_NECTARS, ...TEN], [...TEN]], scripts: createRegistry([nectars()]) });
  settle(g);
  holdEverywhere(g);
  const id = put(g, 'p1', ORACLE_OF_NECTARS);
  settle(g);
  advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return { g, id };
}

describe("D613 - the activation's X", () => {
  test('the vocabulary reads the X only when the cost carries one', () => {
    expect(() => vocabularyEffects(PAYLOAD, ORACLE_OF_NECTARS)).toThrow();
    expect(vocabularyEffects(PAYLOAD, ORACLE_OF_NECTARS, { xCost: true }).map((e) => [e.kind, e.per])).toEqual([['gainLife', { kind: 'spellX' }]]);
  });

  test('an X announced inline is paid and read: three gains three', () => {
    const { g, id } = armed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    const life0 = g.state.players.p1?.life ?? 0;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: id as never, abilityIndex: 0, xValue: 3 }));
    expect(g.state.stack[g.state.stack.length - 1]?.xValue, 'the X rides the stack object').toBe(3);
    settle(g);
    expect(g.state.players.p1?.life).toBe(life0 + 3);
    expect(g.state.players.p1?.pool.C ?? 0, 'the three paid for X').toBe(0);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('an X the host asks for: two gains two, and the source is tapped', () => {
    const { g, id } = armed();
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
    const life0 = g.state.players.p1?.life ?? 0;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: id as never, abilityIndex: 0 }));
    expect(g.state.priority.awaiting?.kind, 'the host asks for X').toBe('chooseX');
    must(g.submit({ t: 'ChooseX', player: 'p1', x: 2 }));
    settle(g);
    expect(g.state.players.p1?.life).toBe(life0 + 2);
    expect(g.state.cards[id as never]?.tapped).toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a negative X is refused', () => {
    const { g, id } = armed();
    const r = g.submit({ t: 'ActivateAbility', player: 'p1', card: id as never, abilityIndex: 0, xValue: -1 });
    expect(r.ok).toBe(false);
  });
});
