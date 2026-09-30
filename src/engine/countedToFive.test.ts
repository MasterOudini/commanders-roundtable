// D590 - THE COUNTED TARGET: the effect vocabulary's counted target phrase read `up to one`, `two` and `three` and
// stopped there (D299), so `tap up to four target permanents` (Elder Deep-Fiend), `up to five target creatures each get
// -1/-1 until end of turn` (Nefashu) and `up to four target permanents you control gain indestructible until end of turn`
// (Invisible Force Field) left their cards blocked on a line the engine already runs for three - and a PLURAL counted subject
// (`up to two target creatures each get +2/+2`, `... gain trample`) was unread at any count: the pump and the grant spelled
// only `gets` and `gains`. What is proven: the lines read whole, the spec counts to four and five; a trigger's `tap up to
// four target permanents` taps four; `up to two target creatures each get +2/+2` pumps both picks; the hash.
import { describe, expect, test } from 'vitest';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { parseEffects } from '../data/effectParse';
import { derive } from './derive';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const hashHolds = (g: Game) => expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
const TEN = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];

/** An upkeep head on Grizzly Bears whose payload the vocabulary reads (the generated vocab shape). */
function head(payload: string): CardScript {
  const card = ORACLE.byName('Grizzly Bears');
  if (!card) throw new Error('Grizzly Bears is not in the fixtures');
  const effects = vocabularyEffects(payload, 'Grizzly Bears');
  const targets = vocabularyTargets(payload);
  return {
    oracleId: card.oracleId,
    name: 'Grizzly Bears',
    triggers: [{
      abilityId: 'upkeep-0',
      text: card.faces[0]?.oracleText ?? '',
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => 'Grizzly Bears - ' + payload,
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets),
    }],
  };
}

describe('D590 - the counted target to five: up to four and five target', () => {
  test('the vocabulary reads four and five: the three lines whole, the spec counted', () => {
    expect(parseEffects('Tap up to four target permanents.', 'Elder Deep-Fiend', true).mode).toBe('auto');
    expect(parseEffects('Up to five target creatures each get -1/-1 until end of turn.', 'Nefashu', true).mode).toBe('auto');
    expect(parseEffects('Up to four target permanents you control gain indestructible until end of turn.', 'Invisible Force Field', true).mode).toBe('auto');
    expect(parseEffects('Up to two target creatures each get +2/+2 and gain trample until end of turn.', 'Press the Advantage', true).mode).toBe('auto');
    expect(parseEffects('Two target creatures you control each get +2/+2 and gain flying until end of turn.', 'Windborne Charge', true).mode).toBe('auto');
    expect(parseEffects('Target creature gets +2/+2 until end of turn.', 'Giant Growth', true).mode, 'the singular stays read').toBe('auto');
    const [four] = vocabularyTargets('Tap up to four target permanents.');
    expect([four?.min, four?.max]).toEqual([0, 4]);
    const [five] = vocabularyTargets('Up to five target creatures each get -1/-1 until end of turn.');
    expect([five?.min, five?.max]).toEqual([0, 5]);
  });

  test('a trigger taps up to four target permanents: four chosen, four tapped', () => {
    const payload = 'Tap up to four target permanents.';
    const g = startedGame({ players: 2, decks: [['Grizzly Bears', ...TEN], ['Walking Corpse', 'Hill Giant', 'Llanowar Elves', 'Cyclops of One-Eyed Pass', ...TEN]], scripts: createRegistry([head(payload)]) });
    settle(g);
    holdEverywhere(g);
    put(g, 'p1', 'Grizzly Bears');
    const picks = [put(g, 'p2', 'Walking Corpse'), put(g, 'p2', 'Hill Giant'), put(g, 'p2', 'Llanowar Elves'), put(g, 'p2', 'Cyclops of One-Eyed Pass')];
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: picks.map((id) => ({ kind: 'card' as const, id })) }));
    settle(g);
    for (const id of picks) expect(g.state.cards[id]?.tapped, 'tapped').toBe(true);
    hashHolds(g);
  });

  test('up to two target creatures each get +2/+2: both picks are pumped', () => {
    const payload = 'Up to two target creatures each get +2/+2 until end of turn.';
    const g = startedGame({ players: 2, decks: [['Grizzly Bears', 'Hill Giant', 'Walking Corpse', ...TEN], ['Llanowar Elves', ...TEN]], scripts: createRegistry([head(payload)]) });
    settle(g);
    holdEverywhere(g);
    put(g, 'p1', 'Grizzly Bears');
    const giant = put(g, 'p1', 'Hill Giant');
    const corpse = put(g, 'p1', 'Walking Corpse');
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: giant }, { kind: 'card', id: corpse }] }));
    settle(g);
    const pt = (id: string) => { const d = derive(g.state, g.deps.oracle, g.deps.scripts, id); return [d.power, d.toughness]; };
    expect(pt(giant), 'Hill Giant 3/3 -> 5/5').toEqual([5, 5]);
    expect(pt(corpse), 'Walking Corpse 2/2 -> 4/4').toEqual([4, 4]);
    hashHolds(g);
  });
});
