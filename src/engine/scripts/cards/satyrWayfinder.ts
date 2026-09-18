// `Satyr Wayfinder` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SATYR_WAYFINDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SATYR_WAYFINDER, "When this creature enters, reveal the top four cards of your library. You may put a land card from among them into your hand. Put the rest into your graveyard.");

const VOCAB_L0 = vocabularyEffects("Reveal the top four cards of your library. You may put a land card from among them into your hand. Put the rest into your graveyard.", SATYR_WAYFINDER.name);
const VOCAB_T_L0 = vocabularyTargets("Reveal the top four cards of your library. You may put a land card from among them into your hand. Put the rest into your graveyard.");

export const SATYR_WAYFINDER_SCRIPT: CardScript = {
  oracleId: SATYR_WAYFINDER.oracleId,
  name: SATYR_WAYFINDER.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Satyr Wayfinder - Reveal the top four cards of your library. You may put a land card from among them into your hand. Put the rest into your graveyard.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
