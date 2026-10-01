// `Burning Sun's Avatar` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BURNING_SUN_S_AVATAR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BURNING_SUN_S_AVATAR, "When this creature enters, it deals 3 damage to target opponent or planeswalker and 3 damage to up to one target creature.");

const VOCAB_L0 = vocabularyEffects("~ deals 3 damage to target opponent or planeswalker and 3 damage to up to one target creature.", BURNING_SUN_S_AVATAR.name);
const VOCAB_T_L0 = vocabularyTargets("~ deals 3 damage to target opponent or planeswalker and 3 damage to up to one target creature.");

export const BURNING_SUNS_AVATAR_SCRIPT: CardScript = {
  oracleId: BURNING_SUN_S_AVATAR.oracleId,
  name: BURNING_SUN_S_AVATAR.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Burning Sun's Avatar - ~ deals 3 damage to target opponent or planeswalker and 3 damage to up to one target creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
