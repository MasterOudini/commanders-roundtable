// D344 - THE VOCABULARY PAYLOAD. A def's `resolve` hands the engine's own
// effect vocabulary its payload: `vocabularyEffects` / `vocabularyTargets`
// (scripts/vocabulary.ts) parse the printed sentence once at module load and
// refuse what the engine cannot run; the def declares the clauses as its
// `targets` (asked as the trigger stacks, CR 603.3d); `ctx.vocabulary` resolves
// the picks still legal for their clause through the executor a spell uses.
// Proven on a testing script over Grizzly Bears (a vanilla body, so the printed
// text claims nothing): an ETB whose payload is a vocabulary sentence.
import { describe, expect, test } from 'vitest';
import { GRIZZLY_BEARS } from '../data/fixtures/engineCards';
import { checkInvariants } from './invariants';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { parseEffects } from '../data/effectParse';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { Game } from './game';
import type { CardScript } from './scripts/api';
import type { InstanceId } from './types/ids';

const BEARS = 'Grizzly Bears';
const CYCLOPS = 'Cyclops of One-Eyed Pass';
const RING = 'Sol Ring';
const MIASMA = 'Hissing Miasma';

const ONE = 'Destroy target artifact.';
const TWO = 'Destroy target artifact. Destroy target enchantment.';
const LIFE = 'You gain 3 life.';

/** A Bears whose ETB payload is the given vocabulary sentence - the shape a generated row takes. */
function bearsWith(payload: string): CardScript {
  const effects = vocabularyEffects(payload, GRIZZLY_BEARS.name);
  const targets = vocabularyTargets(payload);
  return {
    oracleId: GRIZZLY_BEARS.oracleId,
    name: GRIZZLY_BEARS.name,
    triggers: [
      {
        abilityId: 'etb-vocabulary',
        text: 'When this creature enters, ' + payload.charAt(0).toLowerCase() + payload.slice(1),
        event: 'CardsMoved',
        activeZones: ['battlefield'],
        optional: false,
        ...(targets.length > 0 ? { targets } : {}),
        matches: (_ctx, self, ev) =>
          ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
        label: () => 'Grizzly Bears - ' + payload,
        resolve: (ctx, _self, obj) => ctx.vocabulary(obj, effects, targets),
      },
    ],
  };
}

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

type Board = { g: Game; bears: InstanceId; ring: InstanceId; miasma: InstanceId; cyclops: InstanceId };

/** p2's Cyclops, Sol Ring and Hissing Miasma on the board; p1's Bears in the graveyard, ready to enter by hand. */
function board(payload: string): Board {
  const g = startedGame({ players: 2, decks: [[BEARS], [CYCLOPS, RING, MIASMA]], scripts: createRegistry([bearsWith(payload)]) });
  holdEverywhere(g);
  const cyclops = put(g, 'p2', CYCLOPS);
  const ring = put(g, 'p2', RING);
  const miasma = put(g, 'p2', MIASMA);
  settle(g);
  const bears = put(g, 'p1', BEARS, 'graveyard');
  settle(g);
  advanceUntil(g, (s) => s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
  return { g, bears, ring, miasma, cyclops };
}

function enters(b: Board): void {
  must(g_(b).submit({ t: 'ManualMoveCard', player: 'p1', card: b.bears, to: { kind: 'battlefield', player: 'p1' } }));
}
const g_ = (b: Board): Game => b.g;

const cardTarget = (id: InstanceId) => ({ kind: 'card' as const, id });

describe('D344 - the vocabulary payload on a trigger', () => {
  test('the clauses are asked as the trigger stacks, and the vocabulary resolves them', () => {
    const b = board(ONE);
    const { g, ring } = b;
    const life0 = g.state.players.p2?.life ?? 0;
    enters(b);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    const ask = g.state.priority.awaiting;
    expect(ask?.kind).toBe('chooseTargets');
    if (ask?.kind === 'chooseTargets') {
      expect(ask.player).toBe('p1');
      expect(ask.forKind).toBe('trigger');
    }
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [cardTarget(ring)] }));
    settle(g);
    expect(g.state.cards[ring]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
    expect(g.state.players.p2?.life).toBe(life0);
    expect(g.state.narration.some((l) => l.text.includes('resolves'))).toBe(true);
    expect(checkInvariants(g.state)).toEqual([]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('a payload with no clause asks nothing and resolves for its controller', () => {
    const b = board(LIFE);
    const { g } = b;
    const life0 = g.state.players.p1?.life ?? 0;
    enters(b);
    settle(g);
    expect(g.state.priority.awaiting).toBeNull();
    expect(g.state.players.p1?.life).toBe(life0 + 3);
    expect(checkInvariants(g.state)).toEqual([]);
  });

  test("a pick exiled in response is not affected while the other clause resolves (CR 608.2b's other half)", () => {
    const b = board(TWO);
    const { g, ring, miasma } = b;
    enters(b);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [cardTarget(ring), cardTarget(miasma)] }));
    // p2's Sol Ring leaves in response: the destroy aimed at it does nothing, the enchantment still goes.
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: ring, to: { kind: 'exile', player: 'p2' } }));
    settle(g);
    expect(g.state.cards[ring]?.zone).toEqual({ kind: 'exile', player: 'p2' });
    expect(g.state.cards[miasma]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
    expect(checkInvariants(g.state)).toEqual([]);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('every pick gone: the ability does not resolve at all (CR 608.2b)', () => {
    const b = board(TWO);
    const { g, ring, miasma } = b;
    enters(b);
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [cardTarget(ring), cardTarget(miasma)] }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: ring, to: { kind: 'exile', player: 'p2' } }));
    must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: miasma, to: { kind: 'exile', player: 'p2' } }));
    settle(g);
    expect(g.state.cards[ring]?.zone.kind).toBe('exile');
    expect(g.state.cards[miasma]?.zone.kind).toBe('exile');
    expect(g.state.narration.some((l) => l.text.includes('no legal target left'))).toBe(true);
    expect(checkInvariants(g.state)).toEqual([]);
  });
});

describe('D344 - the helpers refuse what the ctx cannot run, at module load', () => {
  test('a sentence the vocabulary does not read whole', () => {
    expect(() => vocabularyEffects('Flip a coin.', 'X')).toThrow(/whole/);
  });

  test('a clause that asks is read only as the LAST effect', () => {
    // D349 - the ask is allowed at the end and nowhere else: `effectEvents` stops at the prompt, so a
    // clause written after one would be dropped in silence. With nothing after it, nothing is dropped.
    expect(vocabularyEffects('Scry 2.', 'X').map((e) => e.kind)).toEqual(['scry']);
    expect(vocabularyEffects('Target opponent discards a card.', 'X').map((e) => e.kind)).toEqual(['discard']);
    expect(vocabularyEffects('You gain 2 life. Surveil 1.', 'X').map((e) => e.kind)).toEqual(['gainLife', 'surveil']);
    // ⚠️ An ask with a clause AFTER it is still the continuation seam and still a throw - and that branch
    // is VACUOUS TODAY, measured: `parseEffects` folds a draw after a scry into `thenDraw`, so "Scry 1.
    // Draw a card." is ONE effect, and every other ask-then-clause sentence comes back `assisted`. A
    // fabricated negative would be a green tick over nothing (D128), so this TRIPWIRES the fact instead:
    // the day the vocabulary reads one of these whole, this fails and the throw gets its real case.
    for (const text of [
      'Target player discards a card. You gain 2 life.',
      'Surveil 1. You gain 2 life.',
      'Scry 2. ~ deals 2 damage to any target.',
      'Target player discards a card. Draw a card.',
    ]) {
      expect(parseEffects(text, 'X', true).mode, text).not.toBe('auto');
    }
  });

  test('a confident clause list, in printed order', () => {
    const clauses = vocabularyTargets(TWO);
    expect(clauses.map((c) => c.kinds)).toEqual([['artifact'], ['enchantment']]);
    expect(vocabularyEffects(TWO, 'X').map((e) => [e.kind, e.targetIndex])).toEqual([
      ['destroy', 0],
      ['destroy', 1],
    ]);
  });
});
