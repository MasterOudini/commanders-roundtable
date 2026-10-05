// `Beetle-Headed Merchants` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BEETLE_HEADED_MERCHANTS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BEETLE_HEADED_MERCHANTS, "Whenever this creature attacks, you may sacrifice another creature or artifact. If you do, draw a card and put a +1/+1 counter on this creature.");

const VOCAB_L0 = vocabularyEffects("You may sacrifice another creature or artifact. If you do, draw a card and put a +1/+1 counter on ~.", BEETLE_HEADED_MERCHANTS.name);
const VOCAB_T_L0 = vocabularyTargets("You may sacrifice another creature or artifact. If you do, draw a card and put a +1/+1 counter on ~.");

export const BEETLE_HEADED_MERCHANTS_SCRIPT: CardScript = {
  oracleId: BEETLE_HEADED_MERCHANTS.oracleId,
  name: BEETLE_HEADED_MERCHANTS.name,
  triggers: [
    {
      abilityId: 'attacks-0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Beetle-Headed Merchants - You may sacrifice another creature or artifact. If you do, draw a card and put a +1/+1 counter on ~.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
