// `Pale Rider of Trostad` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PALE_RIDER_OF_TROSTAD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PALE_RIDER_OF_TROSTAD, "Skulk (This creature can't be blocked by creatures with greater power.)\nWhen this creature enters, discard a card.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Discard a card.", PALE_RIDER_OF_TROSTAD.name);
const VOCAB_T_L1 = vocabularyTargets("Discard a card.");

export const PALE_RIDER_OF_TROSTAD_SCRIPT: CardScript = {
  oracleId: PALE_RIDER_OF_TROSTAD.oracleId,
  name: PALE_RIDER_OF_TROSTAD.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Pale Rider of Trostad - Discard a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
