// D569 - ENDURE N (CR 701.63): "Put N +1/+1 counters on it or create an N/N white Spirit creature token." An effect kind
// aimed at the source (D373), its choice made AT RESOLUTION: the executor raises `endureChoice` and stops (the rest of
// the resolution its continuation, D484); `AnswerEndure` puts the counters or creates the Spirit (a TDM printing, resolved
// at parse time through TOKEN_TABLE - whose generator now seeds endure's Spirits). A permanent that has left the
// battlefield takes no counters: the token alone, asked of nobody (CR 701.63b). What is proven here: the reading (the
// self forms, the Spirit's printing); Sandskitter Outrider's enter trigger asks, and the counters land on it; asked again,
// the Spirit is created instead; with the Outrider gone before its trigger resolves, the Spirit comes unasked; the
// replay hash on each.
import { describe, expect, test } from 'vitest';
import { SANDSKITTER_OUTRIDER } from '../data/fixtures/engineCards';
import { derive } from './derive';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { Game } from './game';
import type { InstanceId } from './types/ids';

const SPIRIT_1 = 'f22410b3-5c0b-4282-9b0b-5ba61229b6e7';
const SPIRIT_2 = 'b83a7343-9f5f-4b79-8929-c84011de401c';
const LINE = (SANDSKITTER_OUTRIDER.faces[0]?.oracleText ?? '').split('\n')[1] as string;
const VOCAB = vocabularyEffects('It endures 2.', SANDSKITTER_OUTRIDER.name);
const VOCAB_T = vocabularyTargets('It endures 2.');
const OUTRIDER: CardScript = {
  oracleId: SANDSKITTER_OUTRIDER.oracleId,
  name: SANDSKITTER_OUTRIDER.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINE,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => 'Sandskitter Outrider - it endures 2',
      resolve: (ctx, _self, obj) => ctx.vocabulary(obj, VOCAB, VOCAB_T),
    },
  ],
};
const SCRIPTS = createRegistry([OUTRIDER]);
const SWAMPS = ['Swamp', 'Swamp', 'Swamp', 'Swamp', 'Swamp', 'Swamp', 'Swamp', 'Swamp'];
const main3 = (g: Game) => advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null && s.stack.length === 0, 40_000);
const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const counters = (g: Game, id: InstanceId): number => g.state.cards[id]?.counters?.['+1/+1'] ?? 0;
function entered(): { g: Game; outrider: InstanceId } {
  const g = startedGame({ players: 2, decks: [['Sandskitter Outrider', ...SWAMPS], ['Grizzly Bears', ...SWAMPS]], scripts: SCRIPTS });
  holdEverywhere(g);
  const outrider = put(g, 'p1', 'Sandskitter Outrider', 'hand');
  main3(g);
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: outrider, to: { kind: 'battlefield', player: 'p1' } }));
  return { g, outrider };
}

describe('D569 - endure', () => {
  test('the reading: the self forms endure, the Spirit resolved to its printing', () => {
    expect(VOCAB.map((e) => [e.kind, e.amount, e.self, e.token?.printingId])).toEqual([['endure', 2, true, SPIRIT_2]]);
    expect(vocabularyEffects('This creature endures 1.', 'Sinkhole Surveyor').map((e) => [e.kind, e.amount, e.token?.printingId])).toEqual([['endure', 1, SPIRIT_1]]);
  });

  test('Sandskitter Outrider enters and endures 2: asked, the counters land on it', () => {
    const { g, outrider } = entered();
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'endureChoice', 20_000);
    expect(g.state.priority.awaiting).toMatchObject({ kind: 'endureChoice', player: 'p1', card: outrider, amount: 2 });
    must(g.submit({ t: 'AnswerEndure', player: 'p1', counters: true }));
    settle(g);
    expect(counters(g, outrider), 'two +1/+1 counters').toBe(2);
    expect(derive(g.state, deps(SCRIPTS).oracle, SCRIPTS, outrider).power).toBe(4);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('answered with the Spirit, a 2/2 white Spirit enters instead and the Outrider takes no counters', () => {
    const { g, outrider } = entered();
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'endureChoice', 20_000);
    const n0 = g.log.length;
    must(g.submit({ t: 'AnswerEndure', player: 'p1', counters: false }));
    settle(g);
    const made = g.log.slice(n0).find((e) => e.body.t === 'TokenCreated');
    expect(made?.body.t === 'TokenCreated' ? [made.body.printingId, made.body.controller] : null).toEqual([SPIRIT_2, 'p1']);
    const spirit = made?.body.t === 'TokenCreated' ? made.body.card : ('' as InstanceId);
    const d = derive(g.state, deps(SCRIPTS).oracle, SCRIPTS, spirit);
    expect([d.power, d.toughness, d.colors, d.typeLine.subtypes]).toEqual([2, 2, ['W'], ['Spirit']]);
    expect(counters(g, outrider)).toBe(0);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('gone before its trigger resolves, the Outrider endures as the Spirit alone - nobody is asked', () => {
    const { g, outrider } = entered();
    advanceUntil(g, (s) => s.stack.some((o) => o.kind === 'triggered'), 20_000);
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: outrider, to: { kind: 'graveyard', player: 'p1' } }));
    const n0 = g.log.length;
    settle(g);
    expect(g.log.slice(n0).some((e) => e.body.t === 'AwaitingSet' && e.body.awaiting?.kind === 'endureChoice'), 'no question').toBe(false);
    const made = g.log.slice(n0).find((e) => e.body.t === 'TokenCreated');
    expect(made?.body.t === 'TokenCreated' ? made.body.printingId : null).toBe(SPIRIT_2);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
