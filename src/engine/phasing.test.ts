// D573 - PHASING (CR 702.26). A phased-out permanent is treated as though it does not exist (702.26b) until it phases in
// during its controller's next untap step (502.1); phasing is no zone change (702.26d); the Auras attached phase out and
// back in with it (702.26g). What is proven here: the reading (the keyword accounted, the effect kind's three forms);
// Sandbar Crocodile's phasing at its controller's untap steps - out, then in; while out it is not in play (no attack, not
// counted); Glorious Anthem phased out by a test trigger - its +1/+1 stops and returns with it; Pacifism phasing with its
// host; phasing in fires no enter trigger; the replay hash on each.
import { describe, expect, test } from 'vitest';
import { LLANOWAR_ELVES } from '../data/fixtures/engineCards';
import { unaccountedLines } from '../data/engineComplete';
import { ENGINE_CARDS } from '../data/fixtures/engineCards';
import { canAttack } from './combat';
import { derive, makeDeriveCache } from './derive';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { GLORIOUS_ANTHEM_SCRIPT } from './scripts/cards/gloriousAnthem';
import { PACIFISM_SCRIPT } from './scripts/cards/pacifism';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import { inPlay } from './zones';
import type { CardScript } from './scripts/api';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

// A test carrier: the Elves' enter trigger phases out a target permanent (the vocabulary's own reading).
const PHASE_TARGET = vocabularyEffects('Target permanent phases out.', LLANOWAR_ELVES.name);
const PHASE_TARGET_T = vocabularyTargets('Target permanent phases out.');
const PHASER: CardScript = {
  oracleId: LLANOWAR_ELVES.oracleId,
  name: LLANOWAR_ELVES.name,
  triggers: [
    {
      abilityId: 'etb-phase',
      text: 'When this creature enters, target permanent phases out.',
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      targets: PHASE_TARGET_T,
      label: () => 'Llanowar Elves - target permanent phases out',
      resolve: (ctx, _self, obj) => ctx.vocabulary(obj, PHASE_TARGET, PHASE_TARGET_T),
    },
  ],
};
const SCRIPTS = createRegistry([GLORIOUS_ANTHEM_SCRIPT, PACIFISM_SCRIPT, PHASER]);
const ISLANDS = ['Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island'];
function game(p1: readonly string[], p2: readonly string[] = []): Game {
  const g = startedGame({ players: 2, decks: [[...p1, ...ISLANDS], [...p2, ...ISLANDS]], scripts: SCRIPTS, options: { maxHandSize: null } });
  holdEverywhere(g);
  return g;
}
/** p1's main phase of `turn` (1, 3, 5 ... are p1's), the stack empty and nothing asked. */
const main = (g: Game, turn: number) => advanceUntil(g, (s) => s.turn.turnNumber === turn && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const pt = (g: Game, id: InstanceId) => { const d = derive(g.state, ORACLE, SCRIPTS, id); return [d.power, d.toughness]; };
const out = (g: Game, id: InstanceId) => g.state.cards[id]?.phasedOut === true;

describe('D573 - phasing', () => {
  test('the reading: the keyword accounted, the effect kind on a target, the source and the referent', () => {
    const croc = ENGINE_CARDS.find((c) => c.name === 'Sandbar Crocodile');
    if (!croc) throw new Error('no fixture Sandbar Crocodile');
    expect(ORACLE.byName('Sandbar Crocodile')?.faces[0]?.keywords).toContain('phasing');
    expect(unaccountedLines(croc, 0)).toEqual([]);
    expect(PHASE_TARGET.map((e) => [e.kind, e.targetIndex])).toEqual([['phaseOut', 0]]);
    expect(vocabularyEffects('This creature phases out.', 'x').map((e) => [e.kind, e.self])).toEqual([['phaseOut', true]]);
    // The referent (D392): `It` is the previous clause's target - aimed where that clause aimed, no target consumed.
    expect(vocabularyEffects('Put a +1/+1 counter on target creature. It phases out.', 'x').map((e) => [e.kind, e.targetIndex])).toEqual([['putCounters', 0], ['phaseOut', 0]]);
  });

  test('Sandbar Crocodile phases out at its controller s untap step and back in at the next - out, it is not in play', () => {
    const g = game(['Sandbar Crocodile']);
    const croc = put(g, 'p1', 'Sandbar Crocodile');
    main(g, 3);
    expect(out(g, croc), 'phased out at turn 3').toBe(true);
    expect(inPlay(g.state)).not.toContain(croc);
    expect(g.state.zones.battlefield, 'still on the battlefield - no zone change').toContain(croc);
    expect(canAttack({ state: g.state, oracle: ORACLE, scripts: SCRIPTS, cache: makeDeriveCache(g.state) }, croc), 'no attack while phased out').toBe(false);
    main(g, 5);
    expect(out(g, croc), 'phased in at turn 5').toBe(false);
    expect(inPlay(g.state)).toContain(croc);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Glorious Anthem phased out: its +1/+1 stops, and returns when it phases in', () => {
    const g = game(['Glorious Anthem', 'Grizzly Bears', 'Llanowar Elves']);
    const anthem = put(g, 'p1', 'Glorious Anthem');
    const bears = put(g, 'p1', 'Grizzly Bears');
    main(g, 1);
    expect(pt(g, bears)).toEqual([3, 3]);
    const elves = put(g, 'p1', 'Llanowar Elves');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: anthem }] }));
    advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
    expect(out(g, anthem)).toBe(true);
    expect(pt(g, bears), 'the anthem does not exist').toEqual([2, 2]);
    expect(pt(g, elves)).toEqual([1, 1]);
    main(g, 3);
    expect(out(g, anthem), 'phased in at its controller s untap step').toBe(false);
    expect(pt(g, bears)).toEqual([3, 3]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('Pacifism phases out with its host and back in with it; phasing in fires no enter trigger', () => {
    const g = game(['Sandbar Crocodile', 'Pacifism', 'Llanowar Elves']);
    const croc = put(g, 'p1', 'Sandbar Crocodile');
    const pacifism = put(g, 'p1', 'Pacifism', 'hand');
    main(g, 1);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: pacifism, targets: [{ kind: 'card', id: croc }] }));
    advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
    expect(g.state.cards[pacifism]?.attachedTo, 'Pacifism on the Crocodile').toBe(croc);
    const elves = put(g, 'p1', 'Llanowar Elves');
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: elves }] }));
    advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
    expect(out(g, elves), 'the Elves phased themselves out').toBe(true);
    const n0 = g.log.length;
    main(g, 3);
    expect([out(g, croc), out(g, pacifism), g.state.cards[pacifism]?.phasedWith], 'the Aura phased out with its host').toEqual([true, true, croc]);
    expect(out(g, elves), 'the Elves phased in at turn 3').toBe(false);
    main(g, 5);
    expect([out(g, croc), out(g, pacifism), g.state.cards[pacifism]?.attachedTo]).toEqual([false, false, croc]);
    expect(g.log.slice(n0).some((e) => e.body.t === 'PendingTriggersAdded' && e.body.triggers.some((t) => t.source === croc || t.source === elves)), 'no enter trigger on phasing in').toBe(false);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
