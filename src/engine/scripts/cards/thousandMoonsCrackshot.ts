// `Thousand Moons Crackshot` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THOUSAND_MOONS_CRACKSHOT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(THOUSAND_MOONS_CRACKSHOT, "Whenever this creature attacks, you may pay {2}{W}. When you do, tap target creature.");

const VOCAB_L0 = vocabularyEffects("You may pay {2}{W}. When you do, tap target creature.", THOUSAND_MOONS_CRACKSHOT.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {2}{W}. When you do, tap target creature.");

export const THOUSAND_MOONS_CRACKSHOT_SCRIPT: CardScript = {
  oracleId: THOUSAND_MOONS_CRACKSHOT.oracleId,
  name: THOUSAND_MOONS_CRACKSHOT.name,
  triggers: [
    {
      abilityId: 'attacks-0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Thousand Moons Crackshot - You may pay {2}{W}. When you do, tap target creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
