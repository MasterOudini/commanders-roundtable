// `Disruptor of Currents` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DISRUPTOR_OF_CURRENTS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DISRUPTOR_OF_CURRENTS, "Flash\nConvoke (Your creatures can help cast this spell. Each creature you tap while casting this spell pays for {1} or one mana of that creature's color.)\nWhen this creature enters, return up to one other target nonland permanent to its owner's hand.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Return up to one other target nonland permanent to its owner's hand.", DISRUPTOR_OF_CURRENTS.name);
const VOCAB_T_L2 = vocabularyTargets("Return up to one other target nonland permanent to its owner's hand.");

export const DISRUPTOR_OF_CURRENTS_SCRIPT: CardScript = {
  oracleId: DISRUPTOR_OF_CURRENTS.oracleId,
  name: DISRUPTOR_OF_CURRENTS.name,
  triggers: [
    {
      abilityId: 'etb-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Disruptor of Currents - Return up to one other target nonland permanent to its owner's hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
