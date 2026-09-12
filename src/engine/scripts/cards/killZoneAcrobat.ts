// `Kill-Zone Acrobat` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KILL_ZONE_ACROBAT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KILL_ZONE_ACROBAT, "Whenever this creature attacks, you may sacrifice another creature or artifact. If you do, this creature gains flying until end of turn.");

const VOCAB_L0 = vocabularyEffects("You may sacrifice another creature or artifact. If you do, this creature gains flying until end of turn.", KILL_ZONE_ACROBAT.name);
const VOCAB_T_L0 = vocabularyTargets("You may sacrifice another creature or artifact. If you do, this creature gains flying until end of turn.");

export const KILL_ZONE_ACROBAT_SCRIPT: CardScript = {
  oracleId: KILL_ZONE_ACROBAT.oracleId,
  name: KILL_ZONE_ACROBAT.name,
  triggers: [
    {
      abilityId: 'attacks-0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Kill-Zone Acrobat - You may sacrifice another creature or artifact. If you do, this creature gains flying until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
