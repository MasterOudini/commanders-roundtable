// `Haazda Snare Squad` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HAAZDA_SNARE_SQUAD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HAAZDA_SNARE_SQUAD, "Whenever this creature attacks, you may pay {W}. If you do, tap target creature an opponent controls.");

const VOCAB_L0 = vocabularyEffects("You may pay {W}. If you do, tap target creature an opponent controls.", HAAZDA_SNARE_SQUAD.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {W}. If you do, tap target creature an opponent controls.");

export const HAAZDA_SNARE_SQUAD_SCRIPT: CardScript = {
  oracleId: HAAZDA_SNARE_SQUAD.oracleId,
  name: HAAZDA_SNARE_SQUAD.name,
  triggers: [
    {
      abilityId: 'attacks-0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Haazda Snare Squad - You may pay {W}. If you do, tap target creature an opponent controls.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
