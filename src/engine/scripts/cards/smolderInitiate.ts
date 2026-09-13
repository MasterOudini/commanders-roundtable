// `Smolder Initiate` - a castSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SMOLDER_INITIATE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SMOLDER_INITIATE, "Whenever a player casts a black spell, you may pay {1}. If you do, target player loses 1 life.");

const VOCAB_L0 = vocabularyEffects("You may pay {1}. If you do, target player loses 1 life.", SMOLDER_INITIATE.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {1}. If you do, target player loses 1 life.");

export const SMOLDER_INITIATE_SCRIPT: CardScript = {
  oracleId: SMOLDER_INITIATE.oracleId,
  name: SMOLDER_INITIATE.name,
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
        ctx.derive(ev.obj.card).colors.includes('B'),
      label: () => "Smolder Initiate - You may pay {1}. If you do, target player loses 1 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
