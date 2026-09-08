// `Welkin Hawk` - a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WELKIN_HAWK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WELKIN_HAWK, "Flying\nWhen this creature dies, you may search your library for a card named Welkin Hawk, reveal that card, put it into your hand, then shuffle.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Search your library for a card named ~, reveal that card, put it into your hand, then shuffle.", WELKIN_HAWK.name);
const VOCAB_T_L1 = vocabularyTargets("Search your library for a card named ~, reveal that card, put it into your hand, then shuffle.");

export const WELKIN_HAWK_SCRIPT: CardScript = {
  oracleId: WELKIN_HAWK.oracleId,
  name: WELKIN_HAWK.name,
  triggers: [
    {
      abilityId: 'dies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Welkin Hawk - Search your library for a card named ~, reveal that card, put it into your hand, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
