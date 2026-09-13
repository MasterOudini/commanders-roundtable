// `Manticore of the Gauntlet` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MANTICORE_OF_THE_GAUNTLET } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MANTICORE_OF_THE_GAUNTLET, "When this creature enters, put a -1/-1 counter on target creature you control. This creature deals 3 damage to target opponent or planeswalker.");

const VOCAB_L0 = vocabularyEffects("Put a -1/-1 counter on target creature you control. ~ deals 3 damage to target opponent or planeswalker.", MANTICORE_OF_THE_GAUNTLET.name);
const VOCAB_T_L0 = vocabularyTargets("Put a -1/-1 counter on target creature you control. ~ deals 3 damage to target opponent or planeswalker.");

export const MANTICORE_OF_THE_GAUNTLET_SCRIPT: CardScript = {
  oracleId: MANTICORE_OF_THE_GAUNTLET.oracleId,
  name: MANTICORE_OF_THE_GAUNTLET.name,
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
      label: () => "Manticore of the Gauntlet - Put a -1/-1 counter on target creature you control. ~ deals 3 damage to target opponent or planeswalker.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
