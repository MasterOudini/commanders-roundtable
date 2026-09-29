// `Glorifier of Suffering` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GLORIFIER_OF_SUFFERING } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GLORIFIER_OF_SUFFERING, "When this creature enters, you may sacrifice another creature or artifact. When you do, put a +1/+1 counter on each of up to two target creatures.");

const VOCAB_L0 = vocabularyEffects("You may sacrifice another creature or artifact. When you do, put a +1/+1 counter on each of up to two target creatures.", GLORIFIER_OF_SUFFERING.name);
const VOCAB_T_L0 = vocabularyTargets("You may sacrifice another creature or artifact. When you do, put a +1/+1 counter on each of up to two target creatures.");

export const GLORIFIER_OF_SUFFERING_SCRIPT: CardScript = {
  oracleId: GLORIFIER_OF_SUFFERING.oracleId,
  name: GLORIFIER_OF_SUFFERING.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Glorifier of Suffering - You may sacrifice another creature or artifact. When you do, put a +1/+1 counter on each of up to two target creatures.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
