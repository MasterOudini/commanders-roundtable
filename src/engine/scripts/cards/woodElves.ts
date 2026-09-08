// `Wood Elves` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WOOD_ELVES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WOOD_ELVES, "When this creature enters, search your library for a Forest card, put that card onto the battlefield, then shuffle.");

const VOCAB_L0 = vocabularyEffects("Search your library for a Forest card, put that card onto the battlefield, then shuffle.", WOOD_ELVES.name);
const VOCAB_T_L0 = vocabularyTargets("Search your library for a Forest card, put that card onto the battlefield, then shuffle.");

export const WOOD_ELVES_SCRIPT: CardScript = {
  oracleId: WOOD_ELVES.oracleId,
  name: WOOD_ELVES.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Wood Elves - Search your library for a Forest card, put that card onto the battlefield, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
