// `Galepowder Mage` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GALEPOWDER_MAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GALEPOWDER_MAGE, "Flying\nWhenever this creature attacks, exile another target creature. Return that card to the battlefield under its owner's control at the beginning of the next end step.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Exile another target creature. Return that card to the battlefield under its owner's control at the beginning of the next end step.", GALEPOWDER_MAGE.name);
const VOCAB_T_L1 = vocabularyTargets("Exile another target creature. Return that card to the battlefield under its owner's control at the beginning of the next end step.");

export const GALEPOWDER_MAGE_SCRIPT: CardScript = {
  oracleId: GALEPOWDER_MAGE.oracleId,
  name: GALEPOWDER_MAGE.name,
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Galepowder Mage - Exile another target creature. Return that card to the battlefield under its owner's control at the beginning of the next end step.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
