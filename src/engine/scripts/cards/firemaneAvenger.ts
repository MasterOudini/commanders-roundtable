// `Firemane Avenger` - a battalion trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FIREMANE_AVENGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FIREMANE_AVENGER, "Flying\nBattalion — Whenever this creature and at least two other creatures attack, this creature deals 3 damage to any target and you gain 3 life.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("~ deals 3 damage to any target and you gain 3 life.", FIREMANE_AVENGER.name);
const VOCAB_T_L1 = vocabularyTargets("~ deals 3 damage to any target and you gain 3 life.");

export const FIREMANE_AVENGER_SCRIPT: CardScript = {
  oracleId: FIREMANE_AVENGER.oracleId,
  name: FIREMANE_AVENGER.name,
  triggers: [
    {
      abilityId: 'battalion-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self) && ev.attackers.length >= 3,
      label: () => "Firemane Avenger - ~ deals 3 damage to any target and you gain 3 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
