// `Izoni, Thousand-Eyed` - a etb trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { IZONI_THOUSAND_EYED } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(IZONI_THOUSAND_EYED, "Undergrowth — When Izoni enters, create a 1/1 black and green Insect creature token for each creature card in your graveyard.\n{B}{G}, Sacrifice another creature: You gain 1 life and draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Create a 1/1 black and green Insect creature token for each creature card in your graveyard.", IZONI_THOUSAND_EYED.name);
const VOCAB_T_L0 = vocabularyTargets("Create a 1/1 black and green Insect creature token for each creature card in your graveyard.");
const VOCAB_A0 = vocabularyEffects("You gain 1 life and draw a card.", IZONI_THOUSAND_EYED.name);
const VOCAB_T_A0 = vocabularyTargets("You gain 1 life and draw a card.");

export const IZONI_THOUSAND_EYED_SCRIPT: CardScript = {
  oracleId: IZONI_THOUSAND_EYED.oracleId,
  name: IZONI_THOUSAND_EYED.name,
  activated: [
    {
      ref: `${IZONI_THOUSAND_EYED.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Izoni, Thousand-Eyed - Create a 1/1 black and green Insect creature token for each creature card in your graveyard.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
