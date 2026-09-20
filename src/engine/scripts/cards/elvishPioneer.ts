// `Elvish Pioneer` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ELVISH_PIONEER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ELVISH_PIONEER, "When this creature enters, you may put a basic land card from your hand onto the battlefield tapped.");

const VOCAB_L0 = vocabularyEffects("Put a basic land card from your hand onto the battlefield tapped.", ELVISH_PIONEER.name);
const VOCAB_T_L0 = vocabularyTargets("Put a basic land card from your hand onto the battlefield tapped.");

export const ELVISH_PIONEER_SCRIPT: CardScript = {
  oracleId: ELVISH_PIONEER.oracleId,
  name: ELVISH_PIONEER.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Elvish Pioneer - Put a basic land card from your hand onto the battlefield tapped.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
