// `Ty Lee, Artful Acrobat` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TY_LEE_ARTFUL_ACROBAT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TY_LEE_ARTFUL_ACROBAT, "Prowess (Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.)\nWhenever Ty Lee attacks, you may pay {1}. When you do, target creature can't block this turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You may pay {1}. When you do, target creature can't block this turn.", TY_LEE_ARTFUL_ACROBAT.name);
const VOCAB_T_L1 = vocabularyTargets("You may pay {1}. When you do, target creature can't block this turn.");

export const TY_LEE_ARTFUL_ACROBAT_SCRIPT: CardScript = {
  oracleId: TY_LEE_ARTFUL_ACROBAT.oracleId,
  name: TY_LEE_ARTFUL_ACROBAT.name,
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Ty Lee, Artful Acrobat - You may pay {1}. When you do, target creature can't block this turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
