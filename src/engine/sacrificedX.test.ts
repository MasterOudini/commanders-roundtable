// D608 - X IS THE SACRIFICED NUMBER. `..., where X is the sacrificed creature's power.` (Call for Blood's -X/-X, Atogatog's
// +X/+X, Korozda Guildmage's X Saprolings, Vish Kal's X counters, Blood-Chin Fanatic's X life) - CR 608.2h's number off D607's stamp
// (`StackObject.sacrificed`), read as D418's counted sentence: X is read as one and the clause is multiplied by the
// number as the object resolves (`CountExpr` `sacrificed`). A pump whose halves mix X and a number (`+X/+1`) stays
// unread - the count scales both halves. What is proven: the vocabulary reads the shapes and refuses the mixed pump;
// Carnage Altar's sacrifice of a 2/2 gives a 4/4 target -2/-2; the hash.
import { describe, expect, test } from 'vitest';
import { derive } from './derive';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { InstanceId } from './types/ids';
import type { Game } from './game';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const TEN = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];
const SHRINK = "Target creature gets -X/-X until end of turn, where X is the sacrificed creature's power.";
const ptOf = (g: Game, id: InstanceId) => { const d = derive(g.state, g.deps.oracle, g.deps.scripts, id); return `${d.power}/${d.toughness}`; };

/** Carnage Altar's printed `{3}, Sacrifice a creature:` activation, resolving the payload through the vocabulary. */
function altar(payload: string): CardScript {
  const card = ORACLE.byName('Carnage Altar');
  if (!card) throw new Error('Carnage Altar is not in the fixtures');
  const effects = vocabularyEffects(payload, 'Carnage Altar');
  const targets = vocabularyTargets(payload);
  return {
    oracleId: card.oracleId,
    name: 'Carnage Altar',
    activated: [{
      ref: card.oracleId + '#a0',
      text: card.faces[0]?.oracleText ?? '',
      ...(targets.length > 0 ? { targets } : {}),
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets),
    }],
  };
}

describe('D608 - X is the sacrificed number', () => {
  test('the vocabulary reads the shapes and refuses the mixed pump', () => {
    const kindsOf = (payload: string, name: string) => vocabularyEffects(payload, name).map((e) => [e.kind, e.per?.kind]);
    expect(kindsOf(SHRINK, 'Call for Blood')).toEqual([['pump', 'sacrificed']]);
    expect(kindsOf("~ gets +X/+X until end of turn, where X is the sacrificed creature's power.", 'Atogatog')).toEqual([['pump', 'sacrificed']]);
    expect(kindsOf("Create X 1/1 green Saproling creature tokens, where X is the sacrificed creature's toughness.", 'Korozda Guildmage')).toEqual([['createToken', 'sacrificed']]);
    expect(kindsOf("Put X +1/+1 counters on target creature, where X is the sacrificed artifact's mana value.", 'Forge Armor')).toEqual([['putCounters', 'sacrificed']]);
    expect(() => vocabularyEffects("~ gets +X/+1 until end of turn, where X is the sacrificed creature's power.", 'Mixed')).toThrow();
  });

  test('a sacrificed 2/2 gives a 4/4 target -2/-2', () => {
    const g = startedGame({ players: 2, decks: [['Carnage Altar', 'Grizzly Bears', ...TEN], ['Air Elemental', ...TEN]], scripts: createRegistry([altar(SHRINK)]) });
    settle(g);
    holdEverywhere(g);
    const altarId = put(g, 'p1', 'Carnage Altar');
    const bears = put(g, 'p1', 'Grizzly Bears');
    const elemental = put(g, 'p2', 'Air Elemental');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    expect(ptOf(g, elemental)).toBe('4/4');
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: altarId, abilityIndex: 0, sacrifice: [bears], targets: [{ kind: 'card', id: elemental }] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(ptOf(g, elemental), 'X read as the 2/2 last existed').toBe('2/2');
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
