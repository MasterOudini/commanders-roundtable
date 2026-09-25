// `Deepglow Skate` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DEEPGLOW_SKATE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DEEPGLOW_SKATE, "When this creature enters, double the number of each kind of counter on any number of target permanents.");

const VOCAB_L0 = vocabularyEffects("Double the number of each kind of counter on any number of target permanents.", DEEPGLOW_SKATE.name);
const VOCAB_T_L0 = vocabularyTargets("Double the number of each kind of counter on any number of target permanents.");

export const DEEPGLOW_SKATE_SCRIPT: CardScript = {
  oracleId: DEEPGLOW_SKATE.oracleId,
  name: DEEPGLOW_SKATE.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Deepglow Skate - Double the number of each kind of counter on any number of target permanents.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
