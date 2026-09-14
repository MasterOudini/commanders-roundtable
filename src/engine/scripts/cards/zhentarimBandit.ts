// `Zhentarim Bandit` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ZHENTARIM_BANDIT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ZHENTARIM_BANDIT, "Whenever this creature attacks, you may pay 1 life. If you do, create a Treasure token. (It's an artifact with \"{T}, Sacrifice this token: Add one mana of any color.\")");

const VOCAB_L0 = vocabularyEffects("You may pay 1 life. If you do, create a Treasure token.", ZHENTARIM_BANDIT.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay 1 life. If you do, create a Treasure token.");

export const ZHENTARIM_BANDIT_SCRIPT: CardScript = {
  oracleId: ZHENTARIM_BANDIT.oracleId,
  name: ZHENTARIM_BANDIT.name,
  triggers: [
    {
      abilityId: 'attacks-0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Zhentarim Bandit - You may pay 1 life. If you do, create a Treasure token.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
