// D587 (FIX-LIST 44) - THE CASUALTY COPY MEETS WARD. Copy into src/engine/.
// The ward-on-copies session (bf39140b) could not run the D585 review's own repro - Light 'Em Up's casualty copy aimed at a
// warded creature - because casualty was not yet on master when it branched; both are on master now. The casualty copy is
// storm's copy (`stormCopySpec`, new targets asked), so the ward trigger meets it once its targets are settled (CR 702.21a,
// 707.10c): unpaid it is countered, paid it resolves. ⚠️ That first proof PASSES on aedb4001 - it pins the merged fix on the
// casualty path rather than failing first. The second fails first with FIX-LIST 8 (the review's WC-2): the casualty copy
// that KEEPS its target after p2 phased the warded Admirer out in response to the casualty trigger triggered that ward
// (CR 702.26b - the Admirer is treated as though it does not exist); now nothing triggers and the copy, its one target
// illegal, fizzles (CR 608.2b), and the spell with it. The replay hash on each.
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

const LIGHT = "Light 'Em Up";
const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const mana = (g: Game, who: PlayerId, symbols: string) => { for (const s of symbols) must(g.submit({ t: 'ManualAddMana', player: who, target: who, symbol: s as 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: 1 })); };
const zoneOf = (g: Game, id: InstanceId) => g.state.cards[id]?.zone.kind ?? 'gone';
const pool = (g: Game, who: PlayerId) => Object.values(g.state.players[who]?.pool ?? {}).reduce((a, b) => a + b, 0);
const since = (g: Game, n0: number): EventBody[] => g.log.slice(n0).map((e) => e.body);
const wardTriggers = (g: Game, n0: number): StackObject[] => since(g, n0).flatMap((b) => (b.t === 'AbilityPutOnStack' && String(b.obj.abilityRef ?? '').endsWith('#ward') ? [b.obj] : []));
const casualtyTriggers = (g: Game, n0: number) => since(g, n0).filter((b) => b.t === 'AbilityPutOnStack' && String(b.obj.abilityRef ?? '').endsWith('#kw:casualty')).length;
const copies = (g: Game, n0: number) => since(g, n0).filter((b) => b.t === 'SpellCopied').length;
const countered = (g: Game, n0: number, id: StackId) => since(g, n0).some((b) => b.t === 'SpellCountered' && b.stackId === id);
const fizzled = (g: Game, n0: number, id: StackId) => since(g, n0).some((b) => b.t === 'SpellFizzled' && b.stackId === id);
const payAsks = (g: Game, n0: number) => since(g, n0).flatMap((b) => (b.t === 'AwaitingSet' && b.awaiting?.kind === 'payMana' ? [b.awaiting] : []));
const hashHolds = (g: Game) => expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());

/** Passes until the copy's new-targets question is up; its copy's stack id. */
function copyAsked(g: Game): StackId {
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets' && s.priority.awaiting.forKind === 'copy', 20_000);
  const a = g.state.priority.awaiting;
  if (a?.kind !== 'chooseTargets' || a.forKind !== 'copy') throw new Error('no copy-targets prompt');
  return a.stackId;
}

/** Passes until the ward's payment prompt is up (the trigger resolving). */
function wardAsked(g: Game) {
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana', 20_000);
  const a = g.state.priority.awaiting;
  if (a?.kind !== 'payMana') throw new Error('no payment prompt');
  return a;
}

/** p2 answers with the phaser: the Elves enter, their trigger is aimed at `id` and resolves, and `id` is phased out. */
function phaseOut(g: Game, id: InstanceId): void {
  put(g, 'p2', 'Llanowar Elves');
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets' && s.priority.awaiting.forKind === 'trigger', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p2', targets: [{ kind: 'card', id }] }));
  advanceUntil(g, (s) => s.cards[id]?.phasedOut === true, 20_000);
}

describe("D587 - the casualty copy meets ward (Light 'Em Up, Casualty 2)", () => {
  test('retargeted at the Admirer (Ward {2}): the ward triggers - unpaid the copy is countered, paid it resolves', () => {
    for (const pays of [false, true]) {
      const g = startedGame({ players: 2, decks: [[LIGHT, 'Hill Giant'], ['Grizzly Bears', 'Toadstool Admirer']], options: { maxHandSize: null } });
      holdEverywhere(g);
      main3(g);
      const spell = put(g, 'p1', LIGHT, 'hand');
      const giant = put(g, 'p1', 'Hill Giant');
      const bears = put(g, 'p2', 'Grizzly Bears');
      const admirer = put(g, 'p2', 'Toadstool Admirer');
      // {1}{R} for the spell; paying, {2} more floats for the ward.
      mana(g, 'p1', pays ? 'RCCC' : 'RC');
      const n0 = g.log.length;
      must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: bears }], casualty: true, sacrifice: [giant] }));
      const copy = copyAsked(g);
      must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: admirer }] }));
      if (pays) {
        const ask = wardAsked(g);
        expect(ask.player, 'the copy controller pays').toBe('p1');
        expect(ask.cost?.raw).toBe('{2}');
        expect(ask.targets).toEqual([{ kind: 'stack', id: copy }]);
        must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true }));
        expect(pool(g, 'p1'), 'the {2} was paid').toBe(0);
      }
      settle(g);
      expect(casualtyTriggers(g, n0), 'the casualty trigger').toBe(1);
      expect(copies(g, n0), 'made the one copy').toBe(1);
      const wards = wardTriggers(g, n0);
      expect(wards, 'one ward trigger').toHaveLength(1);
      expect(wards[0]?.controller, 'the Admirer controller controls it').toBe('p2');
      expect(wards[0]?.source).toBe(admirer);
      expect(wards[0]?.targets, 'the copy rides as its aim').toEqual([{ kind: 'stack', id: copy }]);
      if (!pays) expect(payAsks(g, n0), 'p1 has nothing left: nothing is asked').toHaveLength(0);
      expect(countered(g, n0, copy), pays ? 'paid: the copy resolves' : 'unpaid: the copy is countered').toBe(!pays);
      expect(zoneOf(g, admirer), pays ? 'the copy killed the Admirer' : 'the Admirer lives').toBe(pays ? 'graveyard' : 'battlefield');
      expect([zoneOf(g, bears), zoneOf(g, giant)], 'the spell killed the Bears; the Giant was the casualty').toEqual(['graveyard', 'graveyard']);
      hashHolds(g);
    }
  });

  test('the casualty copy that KEEPS its target after the Admirer phased out triggers no ward (CR 702.26b); copy and spell fizzle', () => {
    const g = startedGame({ players: 2, decks: [[LIGHT, 'Hill Giant'], ['Toadstool Admirer', 'Llanowar Elves']], scripts: createRegistry([PHASER]), options: { maxHandSize: null } });
    holdEverywhere(g);
    main3(g);
    const spell = put(g, 'p1', LIGHT, 'hand');
    const giant = put(g, 'p1', 'Hill Giant');
    const admirer = put(g, 'p2', 'Toadstool Admirer');
    // {1}{R} and the Admirer's ward tax {2}: nothing left.
    mana(g, 'p1', 'RCCC');
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, targets: [{ kind: 'card', id: admirer }], casualty: true, sacrifice: [giant] }));
    expect(pool(g, 'p1'), 'the cast paid the ward tax').toBe(0);
    // p2 answers the casualty trigger: the Admirer phases out before the copy is made.
    phaseOut(g, admirer);
    const copy = copyAsked(g);
    const n0 = g.log.length;
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [] }));
    settle(g);
    expect(wardTriggers(g, n0), 'no ward from a permanent that does not exist').toHaveLength(0);
    expect(countered(g, n0, copy), 'the copy is not countered').toBe(false);
    expect(fizzled(g, n0, copy), 'its one target illegal, the copy fizzles (CR 608.2b)').toBe(true);
    expect([zoneOf(g, admirer), g.state.cards[admirer]?.phasedOut], 'untouched, still phased out').toEqual(['battlefield', true]);
    expect([zoneOf(g, spell), zoneOf(g, giant)], 'the spell fizzled too; the Giant was the casualty').toEqual(['graveyard', 'graveyard']);
    hashHolds(g);
  });
});
