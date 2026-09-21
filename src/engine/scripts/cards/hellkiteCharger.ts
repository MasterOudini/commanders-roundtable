// `Hellkite Charger` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HELLKITE_CHARGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HELLKITE_CHARGER, "Flying, haste\nWhenever this creature attacks, you may pay {5}{R}{R}. If you do, untap all attacking creatures and after this phase, there is an additional combat phase.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You may pay {5}{R}{R}. If you do, untap all attacking creatures and after this phase, there is an additional combat phase.", HELLKITE_CHARGER.name);
const VOCAB_T_L1 = vocabularyTargets("You may pay {5}{R}{R}. If you do, untap all attacking creatures and after this phase, there is an additional combat phase.");

export const HELLKITE_CHARGER_SCRIPT: CardScript = {
  oracleId: HELLKITE_CHARGER.oracleId,
  name: HELLKITE_CHARGER.name,
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Hellkite Charger - You may pay {5}{R}{R}. If you do, untap all attacking creatures and after this phase, there is an additional combat phase.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
