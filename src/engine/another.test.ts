// D414 - THE ANOTHER QUALIFIER: "another target creature you control" refuses the resolving object's own
// source. The parser carries `another` on the spec (nothing unenforced), the aim layer refuses the source
// (`TargetingSource.sourceId`), and the client's mirror agrees.

import { describe, expect, test } from 'vitest';
import { parseTargetClauses } from '../data/targetParse';
import { primitiveFor } from '../data/primitives';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, deps as depsOf, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import { candidatesFromState, legalTargetsFor } from './targets';
import { targetingSourceFor } from './loop';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
}
function attacks(name: string, payload: string): CardScript {
  const card = ORACLE.byName(name);
  if (!card) throw new Error(name + ' is not in the fixtures');
  const effects = vocabularyEffects(payload, name);
  const targets = vocabularyTargets(payload);
  return {
    oracleId: card.oracleId, name,
    triggers: [{
      abilityId: 'attacks-0', text: card.faces[0]?.oracleText ?? '', event: 'AttackersDeclared', activeZones: ['battlefield'], optional: false, targets,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => name + ' - ' + payload,
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets),
    }],
  };
}
const CONDOR = attacks('Trained Condor', 'Another target creature you control gains flying until end of turn.');
const SCRIPTS = createRegistry([CONDOR]);

describe('the another qualifier (D414)', () => {
  test('the parser: another target creature you control is confident with nothing unenforced and carries the flag; up to one other target too; the accounting takes the line', () => {
    const [spec] = parseTargetClauses('Another target creature you control gains flying until end of turn.');
    expect(spec?.confident).toBe(true);
    expect(spec?.unenforced).toEqual([]);
    expect(spec?.another).toBe(true);
    expect(spec?.controller).toBe('you');
    const [other] = parseTargetClauses('Tap up to one other target creature.');
    expect(other?.another).toBe(true);
    expect(other?.min).toBe(0);
    const [plain] = parseTargetClauses('Target creature gains flying until end of turn.');
    expect(plain?.another).toBeUndefined();
    // The trigger line is a ROW's to claim; the classifier rates it scriptable (it was `unclassified` behind the word).
    expect(primitiveFor({ text: 'Whenever this creature attacks, another target creature you control gains flying until end of turn.', kind: 'sentence', raw: '' }, 'Trained Condor')).toBe('scriptable');
  });

  test('the Condor attacks: itself is refused, the Bears admitted, the flying lands on the Bears; the host and the client agree; the replay hash', () => {
    const g = startedGame({ players: 2, decks: [['Trained Condor', 'Grizzly Bears'], ['Cyclops of One-Eyed Pass']], scripts: SCRIPTS });
    holdEverywhere(g);
    settle(g);
    const condor = put(g, 'p1', 'Trained Condor');
    const bears = put(g, 'p1', 'Grizzly Bears');
    settle(g);
    const t0 = g.state.turn.turnNumber;
    advanceUntil(g, (s) => s.turn.turnNumber >= t0 + 2 && s.turn.activePlayer === 'p1' && s.priority.awaiting?.kind === 'declareAttackers', 40_000);
    must(g.submit({ t: 'DeclareAttackers', player: 'p1', attackers: [{ card: condor, defender: { kind: 'player', id: 'p2' } }] }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    const ask = g.state.priority.awaiting;
    expect(ask?.kind).toBe('chooseTargets');
    const specs = ask?.kind === 'chooseTargets' ? ask.specs : [];
    const d = depsOf(SCRIPTS);
    const src = targetingSourceFor(g.state, d, condor, 'p1');
    expect(src?.sourceId).toBe(condor);
    const legal = src ? legalTargetsFor(specs[0]!, src, candidatesFromState(g.state, d)) : [];
    expect(legal.map((c) => c.id)).toEqual([bears]);
    expect(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: condor }] }).ok, 'itself refused').toBe(false);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
    settle(g);
    expect(g.state.untilEndOfTurn.some((e) => e.card === bears && (e.keywords ?? []).includes('flying'))).toBe(true);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
