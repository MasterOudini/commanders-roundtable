// `Sower of Temptation` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SOWER_OF_TEMPTATION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SOWER_OF_TEMPTATION, "Flying\nWhen this creature enters, gain control of target creature for as long as this creature remains on the battlefield.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Gain control of target creature for as long as this creature remains on the battlefield.", SOWER_OF_TEMPTATION.name);
const VOCAB_T_L1 = vocabularyTargets("Gain control of target creature for as long as this creature remains on the battlefield.");

export const SOWER_OF_TEMPTATION_SCRIPT: CardScript = {
  oracleId: SOWER_OF_TEMPTATION.oracleId,
  name: SOWER_OF_TEMPTATION.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Sower of Temptation - Gain control of target creature for as long as this creature remains on the battlefield.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
