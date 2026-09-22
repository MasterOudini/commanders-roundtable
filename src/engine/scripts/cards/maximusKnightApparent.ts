// `Maximus, Knight Apparent` - a etb trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MAXIMUS_KNIGHT_APPARENT } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces[0]?.oracleText;
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(MAXIMUS_KNIGHT_APPARENT, "Trample\nWhen Maximus enters, you may search your library for an Equipment card with mana value 2, reveal it, put it into your hand, then shuffle.\n{1}, Sacrifice an artifact: You get {E}{E} (two energy counters).");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Search your library for an Equipment card with mana value 2, reveal it, put it into your hand, then shuffle.", MAXIMUS_KNIGHT_APPARENT.name);
const VOCAB_T_L1 = vocabularyTargets("Search your library for an Equipment card with mana value 2, reveal it, put it into your hand, then shuffle.");
const VOCAB_A0 = vocabularyEffects("You get {E}{E}.", MAXIMUS_KNIGHT_APPARENT.name);
const VOCAB_T_A0 = vocabularyTargets("You get {E}{E}.");

export const MAXIMUS_KNIGHT_APPARENT_SCRIPT: CardScript = {
  oracleId: MAXIMUS_KNIGHT_APPARENT.oracleId,
  name: MAXIMUS_KNIGHT_APPARENT.name,
  activated: [
    {
      ref: `${MAXIMUS_KNIGHT_APPARENT.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Maximus, Knight Apparent - Search your library for an Equipment card with mana value 2, reveal it, put it into your hand, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
