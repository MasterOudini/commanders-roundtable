// `Nurturer Initiate` - a castSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NURTURER_INITIATE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NURTURER_INITIATE, "Whenever a player casts a green spell, you may pay {1}. If you do, target creature gets +1/+1 until end of turn.");

const VOCAB_L0 = vocabularyEffects("You may pay {1}. If you do, target creature gets +1/+1 until end of turn.", NURTURER_INITIATE.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {1}. If you do, target creature gets +1/+1 until end of turn.");

export const NURTURER_INITIATE_SCRIPT: CardScript = {
  oracleId: NURTURER_INITIATE.oracleId,
  name: NURTURER_INITIATE.name,
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
      label: () => "Nurturer Initiate - You may pay {1}. If you do, target creature gets +1/+1 until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
