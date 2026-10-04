// D615 - SPEED (CR 702.179, Aetherdrift). `Start your engines!` (a keyword): a player with no speed who controls a
// permanent with it has speed 1. A player's speed rises by one, once each turn, when an opponent loses life during that
// player's turn, and never past 4 - the inherent trigger, resolved by the state check here (D615 records the
// simplification). `Max speed — <ability>` is that ability while the speed is 4: an activation `activateOnly` it
// (`maxSpeed`); `where X is your speed` / `equal to your speed` count it (`CountExpr` `speed`). The seat shows it, and a
// manual tool sets it (Tier 3). What is proven: the reads; the start; the rise - once a turn, only on the speed holder's
// turn, never past 4; a max speed activation refused at 3 and allowed at 4; the seat; the hash.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { project } from './project';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const TEN = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];
const speedOf = (g: Game, p: 'p1' | 'p2') => g.state.players[p]?.speed;

/** Amonkhet Raceway's `Max speed — {T}: Target creature gains haste until end of turn.`, through the vocabulary. */
function raceway(index: number): CardScript {
  const card = ORACLE.byName('Amonkhet Raceway');
  if (!card) throw new Error('Amonkhet Raceway is not in the fixtures');
  const payload = 'Target creature gains haste until end of turn.';
  const effects = vocabularyEffects(payload, 'Amonkhet Raceway');
  const targets = vocabularyTargets(payload);
  return {
    oracleId: card.oracleId,
    name: 'Amonkhet Raceway',
    activated: [{
      ref: card.oracleId + '#a' + index,
      text: card.faces[0]?.oracleText ?? '',
      ...(targets.length > 0 ? { targets } : {}),
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets),
    }],
  };
}

function myTurn(g: Game, turn: number): void {
  advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === (turn % 2 === 1 ? 'p1' : 'p2') && s.priority.awaiting === null, 40_000);
}

describe('D615 - speed', () => {
  test('the keyword, the max speed activation and the speed count are read', () => {
    expect(ORACLE.byName('Streaking Oilgorger')?.faces[0]?.keywords).toContain('startYourEngines');
    const act = ORACLE.byName('Amonkhet Raceway')?.faces[0]?.activated.find((a) => !a.isManaAbility);
    expect(act?.activateOnly).toEqual([{ kind: 'maxSpeed' }]);
    const per = (p: string) => vocabularyEffects(p, 'The Speed Demon').map((e) => [e.kind, e.per]);
    expect(per('Draw X cards, where X is your speed.')).toEqual([['draw', { kind: 'speed' }]]);
    expect(per('You gain life equal to your speed.')).toEqual([['gainLife', { kind: 'speed' }]]);
  });

  test('speed starts at 1, rises once a turn on its holder\'s turn, and stops at 4', () => {
    const g = startedGame({ players: 2, decks: [['Streaking Oilgorger', ...TEN], [...TEN]], scripts: createRegistry([]) });
    settle(g);
    holdEverywhere(g);
    expect(speedOf(g, 'p1'), 'no speed before the keyword').toBeUndefined();
    put(g, 'p1', 'Streaking Oilgorger');
    settle(g);
    expect(speedOf(g, 'p1'), 'the keyword starts it').toBe(1);
    expect(speedOf(g, 'p2')).toBeUndefined();
    myTurn(g, 3);
    must(g.submit({ t: 'ManualSetLife', player: 'p1', target: 'p2', delta: -1 }));
    settle(g);
    expect(speedOf(g, 'p1'), 'an opponent lost life on my turn').toBe(2);
    must(g.submit({ t: 'ManualSetLife', player: 'p1', target: 'p2', delta: -1 }));
    settle(g);
    expect(speedOf(g, 'p1'), 'once each turn').toBe(2);
    myTurn(g, 4);
    must(g.submit({ t: 'ManualSetLife', player: 'p2', target: 'p2', delta: -1 }));
    settle(g);
    expect(speedOf(g, 'p1'), 'not on the opponent\'s turn').toBe(2);
    must(g.submit({ t: 'ManualSetSpeed', player: 'p1', target: 'p1', to: 4 }));
    myTurn(g, 5);
    must(g.submit({ t: 'ManualSetLife', player: 'p1', target: 'p2', delta: -1 }));
    settle(g);
    expect(speedOf(g, 'p1'), 'max speed is 4').toBe(4);
    expect(project(g.state, g.deps.oracle, g.deps.scripts, 'p2').seats.p1?.speed, 'the seat shows it to everyone').toBe(4);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a max speed activation is refused at 3 and allowed at 4', () => {
    const index = ORACLE.byName('Amonkhet Raceway')?.faces[0]?.activated.findIndex((a) => !a.isManaAbility) ?? -1;
    const g = startedGame({ players: 2, decks: [['Amonkhet Raceway', 'Grizzly Bears', ...TEN], [...TEN]], scripts: createRegistry([raceway(index)]) });
    settle(g);
    holdEverywhere(g);
    const lot = put(g, 'p1', 'Amonkhet Raceway');
    const bears = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    myTurn(g, 3);
    must(g.submit({ t: 'ManualSetSpeed', player: 'p1', target: 'p1', to: 3 }));
    const early = g.submit({ t: 'ActivateAbility', player: 'p1', card: lot, abilityIndex: index, targets: [{ kind: 'card', id: bears }] });
    expect(early.ok, 'refused below max speed').toBe(false);
    must(g.submit({ t: 'ManualSetSpeed', player: 'p1', target: 'p1', to: 4 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: lot, abilityIndex: index, targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.cards[lot]?.tapped).toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
