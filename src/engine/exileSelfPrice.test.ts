// D609 - THE DYING CARD'S OWN EXILE AS A PRICE. `When this creature dies, you may exile it. If you do, <body>.` (Academy
// Rector, Arena Rector, Greenwarden of Murasa, Iname as One) and its reflexive form `... you may exile it. When you do,
// <payload>` (Undead Butler, Paramecia Coloniex) - D415's verb price, where the object paid is the source itself, in its
// owner's graveyard (CR 603.10a: the dies trigger looks back; the card is a graveyard card by then). Payable while the card
// is still there (CR 400.7: a card that left the graveyard is a new object - nothing to exile, nothing paid). What is proven:
// the vocabulary reads the price; paying exiles the card from the graveyard and the body happens; declining leaves it and
// the body does not; the hash.
import { describe, expect, test } from 'vitest';
import { parseEffects } from '../data/effectParse';
import { replay, stateHash } from './log';
import { createRegistry } from './scripts/registryCore';
import { vocabularyEffects, vocabularyTargets } from './scripts/vocabulary';
import { advanceUntil, holdEverywhere, must, put, startedGame, ORACLE } from './testing/harness';
import type { CardScript } from './scripts/api';
import type { EventBody } from './types/events';
import type { Game } from './game';

const settle = (g: Game) => advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0 && s.priority.awaiting === null, 20_000);
const TEN = ['Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'];
const PAYLOAD = 'you may exile it. If you do, you gain 3 life.';

/** A dies head on `name` whose payload the vocabulary reads (the generated dies shape: looks back). */
function diesHead(name: string, payload: string): CardScript {
  const card = ORACLE.byName(name);
  if (!card) throw new Error(name + ' is not in the fixtures');
  const effects = vocabularyEffects(payload, name);
  const targets = vocabularyTargets(payload);
  return {
    oracleId: card.oracleId,
    name,
    triggers: [{
      abilityId: 'dies-0',
      text: card.faces[0]?.oracleText ?? '',
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      targets,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => name + ' - ' + payload,
      resolve: (ctx, _self, obj): readonly EventBody[] => ctx.vocabulary(obj, effects, targets),
    }],
  };
}

function dyingBears(): { g: Game; bears: string; life0: number } {
  const g = startedGame({ players: 2, decks: [['Grizzly Bears', ...TEN], ['Forest', ...TEN]], scripts: createRegistry([diesHead('Grizzly Bears', PAYLOAD)]) });
  settle(g);
  holdEverywhere(g);
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  const life0 = g.state.players['p1']?.life ?? 0;
  must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: bears, to: { kind: 'graveyard', player: 'p1' } }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'payMana', 20_000);
  return { g, bears, life0 };
}

describe('D609 - the dying card' + String.fromCharCode(39) + 's own exile as a price', () => {
  test('the vocabulary reads the price', () => {
    const [e] = parseEffects('You may exile it. If you do, return target card from your graveyard to your hand.', 'Greenwarden of Murasa', true).effects;
    expect([e?.kind, e?.pay?.verbs?.exileSelf, e?.pay?.ifPaid.map((x) => x.kind)]).toEqual(['payOptional', true, ['returnFromGraveyard']]);
  });

  test('paying exiles the card from the graveyard, and the body happens', () => {
    const { g, bears, life0 } = dyingBears();
    expect(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true, picks: ['nope'] }).ok, 'only the dying card itself').toBe(false);
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: true, picks: [bears] }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('exile');
    expect((g.state.players['p1']?.life ?? 0) - life0).toBe(3);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  test('declining leaves it in the graveyard, and the body does not happen', () => {
    const { g, bears, life0 } = dyingBears();
    must(g.submit({ t: 'AnswerPayMana', player: 'p1', pay: false }));
    settle(g);
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life ?? 0).toBe(life0);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
