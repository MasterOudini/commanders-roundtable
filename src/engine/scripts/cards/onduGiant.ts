// `Ondu Giant` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ONDU_GIANT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ONDU_GIANT, "When this creature enters, you may search your library for a basic land card, put it onto the battlefield tapped, then shuffle.");

const VOCAB_L0 = vocabularyEffects("Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.", ONDU_GIANT.name);
const VOCAB_T_L0 = vocabularyTargets("Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.");

export const ONDU_GIANT_SCRIPT: CardScript = {
  oracleId: ONDU_GIANT.oracleId,
  name: ONDU_GIANT.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Ondu Giant - Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
