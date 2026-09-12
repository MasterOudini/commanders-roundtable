// `Civil Servant` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CIVIL_SERVANT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CIVIL_SERVANT, "Whenever this creature attacks, you may tap another untapped Citizen you control. If you do, this creature gets +1/+0 and gains lifelink until end of turn.");

const VOCAB_L0 = vocabularyEffects("You may tap another untapped Citizen you control. If you do, this creature gets +1/+0 and gains lifelink until end of turn.", CIVIL_SERVANT.name);
const VOCAB_T_L0 = vocabularyTargets("You may tap another untapped Citizen you control. If you do, this creature gets +1/+0 and gains lifelink until end of turn.");

export const CIVIL_SERVANT_SCRIPT: CardScript = {
  oracleId: CIVIL_SERVANT.oracleId,
  name: CIVIL_SERVANT.name,
  triggers: [
    {
      abilityId: 'attacks-0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Civil Servant - You may tap another untapped Citizen you control. If you do, this creature gets +1/+0 and gains lifelink until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
