// `Taunting Kobold` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TAUNTING_KOBOLD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TAUNTING_KOBOLD, "Haste\nWhenever this creature attacks, goad target creature an opponent controls. (Until your next turn, that creature attacks each combat if able and attacks a player other than you if able.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Goad target creature an opponent controls.", TAUNTING_KOBOLD.name);
const VOCAB_T_L1 = vocabularyTargets("Goad target creature an opponent controls.");

export const TAUNTING_KOBOLD_SCRIPT: CardScript = {
  oracleId: TAUNTING_KOBOLD.oracleId,
  name: TAUNTING_KOBOLD.name,
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Taunting Kobold - Goad target creature an opponent controls.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
