// `Giant Harbinger` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GIANT_HARBINGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GIANT_HARBINGER, "When this creature enters, you may search your library for a Giant card, reveal it, then shuffle and put that card on top.");

const VOCAB_L0 = vocabularyEffects("Search your library for a Giant card, reveal it, then shuffle and put that card on top.", GIANT_HARBINGER.name);
const VOCAB_T_L0 = vocabularyTargets("Search your library for a Giant card, reveal it, then shuffle and put that card on top.");

export const GIANT_HARBINGER_SCRIPT: CardScript = {
  oracleId: GIANT_HARBINGER.oracleId,
  name: GIANT_HARBINGER.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Giant Harbinger - Search your library for a Giant card, reveal it, then shuffle and put that card on top.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
