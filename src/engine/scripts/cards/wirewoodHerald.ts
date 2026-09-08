// `Wirewood Herald` - a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WIREWOOD_HERALD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WIREWOOD_HERALD, "When this creature dies, you may search your library for an Elf card, reveal that card, put it into your hand, then shuffle.");

const VOCAB_L0 = vocabularyEffects("Search your library for an Elf card, reveal that card, put it into your hand, then shuffle.", WIREWOOD_HERALD.name);
const VOCAB_T_L0 = vocabularyTargets("Search your library for an Elf card, reveal that card, put it into your hand, then shuffle.");

export const WIREWOOD_HERALD_SCRIPT: CardScript = {
  oracleId: WIREWOOD_HERALD.oracleId,
  name: WIREWOOD_HERALD.name,
  triggers: [
    {
      abilityId: 'dies-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Wirewood Herald - Search your library for an Elf card, reveal that card, put it into your hand, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
