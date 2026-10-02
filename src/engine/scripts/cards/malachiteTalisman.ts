// `Malachite Talisman` - a castSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MALACHITE_TALISMAN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MALACHITE_TALISMAN, "Whenever a player casts a green spell, you may pay {3}. If you do, untap target permanent.");

const VOCAB_L0 = vocabularyEffects("You may pay {3}. If you do, untap target permanent.", MALACHITE_TALISMAN.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {3}. If you do, untap target permanent.");

export const MALACHITE_TALISMAN_SCRIPT: CardScript = {
  oracleId: MALACHITE_TALISMAN.oracleId,
  name: MALACHITE_TALISMAN.name,
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
        ctx.derive(ev.obj.card).colors.includes('G'),
      label: () => "Malachite Talisman - You may pay {3}. If you do, untap target permanent.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
