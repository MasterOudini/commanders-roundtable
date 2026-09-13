// `Lightning Cloud` - a castSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LIGHTNING_CLOUD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LIGHTNING_CLOUD, "Whenever a player casts a red spell, you may pay {R}. If you do, this enchantment deals 1 damage to any target.");

const VOCAB_L0 = vocabularyEffects("You may pay {R}. If you do, this enchantment deals 1 damage to any target.", LIGHTNING_CLOUD.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {R}. If you do, this enchantment deals 1 damage to any target.");

export const LIGHTNING_CLOUD_SCRIPT: CardScript = {
  oracleId: LIGHTNING_CLOUD.oracleId,
  name: LIGHTNING_CLOUD.name,
  triggers: [
    {
      abilityId: 'castSpell-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, _self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ctx.derive(ev.obj.card).colors.includes('R'),
      label: () => "Lightning Cloud - You may pay {R}. If you do, this enchantment deals 1 damage to any target.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
