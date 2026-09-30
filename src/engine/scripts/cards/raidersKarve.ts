// `Raiders' Karve` - a vehicleAttacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RAIDERS_KARVE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RAIDERS_KARVE, "Whenever this Vehicle attacks, look at the top card of your library. If it's a land card, you may put it onto the battlefield tapped.\nCrew 3 (Tap any number of creatures you control with total power 3 or more: This Vehicle becomes an artifact creature until end of turn.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Look at the top card of your library. If it's a land card, you may put it onto the battlefield tapped.", RAIDERS_KARVE.name);
const VOCAB_T_L0 = vocabularyTargets("Look at the top card of your library. If it's a land card, you may put it onto the battlefield tapped.");

export const RAIDERS_KARVE_SCRIPT: CardScript = {
  oracleId: RAIDERS_KARVE.oracleId,
  name: RAIDERS_KARVE.name,
  triggers: [
    {
      abilityId: 'vehicleAttacks-0',
      text: LINES[0] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Raiders' Karve - Look at the top card of your library. If it's a land card, you may put it onto the battlefield tapped.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
