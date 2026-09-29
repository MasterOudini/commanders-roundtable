// D587 (FIX-LIST 8, the review's WC-2) - A PHASED-OUT PERMANENT'S WARD NEVER TRIGGERS. Copy into src/engine/.
// A phased-out permanent is treated as though it does not exist (CR 702.26b): it stays in the battlefield zone (`phasedOut`,
// no zone change - D573) and its abilities cannot trigger. A cast can never target one (targets.ts `candidateFor`), so the
// ward TAX never met one; but a spell copy may KEEP its original's targets, an illegal one included (CR 707.10c), and the
// merged ward-on-copies trigger (bf39140b) read `wardsMet`, which asked only the zone - the phased-out Patchwork Automaton
// a Twincast copy kept countered the copy. What is proven here: p1 casts Explosive Entry at p2's Automaton (paying its ward
// tax) and p2's Grizzly Bears; p2 phases the Automaton out in response (phasing.test.ts's carrier - a scripted Llanowar
// Elves enter trigger); p1 Twincasts the Entry with nothing to spare and keeps the targets: no ward trigger, the copy is not
// countered and resolves for the Bears alone (CR 608.2b), the original likewise - two counters on the Bears, the Automaton
// untouched and still phased out; the replay hash.
import { describe, expect, test } from 'vitest';
import { LLANOWAR_ELVES } from '../data/fixtures/engineCards';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import type { CardScript } from './scripts/api';
import type { Game } from './game';
import type { InstanceId, PlayerId, StackId } from './types/ids';
import type { EventBody } from './types/events';
import type { StackObject } from './types/state';

// The test carrier (phasing.test.ts's): the Elves' enter trigger phases out a target permanent - the vocabulary's own reading.
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

const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const mana = (g: Game, who: PlayerId, symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const top = (g: Game) => g.state.stack[g.state.stack.length - 1]?.id as StackId;
const zoneOf = (g: Game, id: InstanceId) => g.state.cards[id]?.zone.kind ?? 'gone';
const pool = (g: Game, who: PlayerId) => Object.values(g.state.players[who]?.pool ?? {}).reduce((a, b) => a + b, 0);
const since = (g: Game, n0: number): EventBody[] => g.log.slice(n0).map((e) => e.body);
const wardTriggers = (g: Game, n0: number): StackObject[] => since(g, n0).flatMap((b) => (b.t === 'AbilityPutOnStack' && String(b.obj.abilityRef ?? '').endsWith('#ward') ? [b.obj] : []));
const countered = (g: Game, n0: number, id: StackId) => since(g, n0).some((b) => b.t === 'SpellCountered' && b.stackId === id);
const hashHolds = (g: Game) => expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());

/** Passes until the copy's new-targets question is up; its copy's stack id. */
function copyAsked(g: Game): StackId {
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets' && s.priority.awaiting.forKind === 'copy', 20_000);
  const a = g.state.priority.awaiting;
  if (a?.kind !== 'chooseTargets' || a.forKind !== 'copy') throw new Error('no copy-targets prompt');
  return a.stackId;
}

/** p2 answers with the phaser: the Elves enter, their trigger is aimed at `id` and resolves, and `id` is phased out. */
function phaseOut(g: Game, id: InstanceId): void {
  put(g, 'p2', 'Llanowar Elves');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets' && s.priority.awaiting.forKind === 'trigger', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p2', targets: [{ kind: 'card', id }] }));
  advanceUntil(g, (s) => s.cards[id]?.phasedOut === true, 20_000);
}

describe('D587 - a phased-out permanent does not ward (CR 702.26b)', () => {
  test('a Twincast copy that KEEPS the phased-out Automaton as a target triggers no ward and resolves for the Bears (CR 608.2b)', () => {
    const g = startedGame({ players: 2, decks: [['Explosive Entry', 'Twincast'], ['Patchwork Automaton', 'Grizzly Bears', 'Llanowar Elves']], scripts: createRegistry([PHASER]), options: { maxHandSize: null } });
    holdEverywhere(g);
    main3(g);
    const entry = put(g, 'p1', 'Explosive Entry', 'hand');
    const twin = put(g, 'p1', 'Twincast', 'hand');
    const automaton = put(g, 'p2', 'Patchwork Automaton');
    const bears = put(g, 'p2', 'Grizzly Bears');
    // Explosive Entry: `Destroy up to one target artifact. Put a +1/+1 counter on up to one target creature.`
    mana(g, 'p1', 'RCCC');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: entry, targets: [{ kind: 'card', id: automaton }, { kind: 'card', id: bears }] }));
    expect(pool(g, 'p1'), 'the cast paid the Automaton ward tax').toBe(0);
    const entryObj = top(g);
    phaseOut(g, automaton);
    expect(g.state.cards[automaton]?.zone.kind, 'phasing is no zone change (CR 702.26d)').toBe('battlefield');
    expect(g.state.stack.map((o) => o.id), 'the Entry still waits').toContain(entryObj);
    mana(g, 'p1', 'UU');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: twin, targets: [{ kind: 'stack', id: entryObj }] }));
    const copy = copyAsked(g);
    const n0 = g.log.length;
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [] }));
    settle(g);
    expect(wardTriggers(g, n0), 'a permanent treated as though it does not exist: no ward').toHaveLength(0);
    expect(countered(g, n0, copy), 'the copy is not countered').toBe(false);
    expect([zoneOf(g, automaton), g.state.cards[automaton]?.phasedOut], 'untouched, still phased out').toEqual(['battlefield', true]);
    expect(g.state.cards[bears]?.counters['+1/+1'] ?? 0, 'the copy and the original each put a counter on the Bears').toBe(2);
    hashHolds(g);
  });
});
