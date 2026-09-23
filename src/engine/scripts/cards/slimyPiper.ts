// `Slimy Piper` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SLIMY_PIPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SLIMY_PIPER, "Whenever this creature attacks, it gets +1/+1 until end of turn. If you control four or more creatures, it gets +2/+2 and gains indestructible until end of turn instead. (Damage and effects that say \"destroy\" don't destroy it.)");

const VOCAB_L0 = vocabularyEffects("~ gets +1/+1 until end of turn. If you control four or more creatures, it gets +2/+2 and gains indestructible until end of turn instead.", SLIMY_PIPER.name);
const VOCAB_T_L0 = vocabularyTargets("~ gets +1/+1 until end of turn. If you control four or more creatures, it gets +2/+2 and gains indestructible until end of turn instead.");

export const SLIMY_PIPER_SCRIPT: CardScript = {
  oracleId: SLIMY_PIPER.oracleId,
  name: SLIMY_PIPER.name,
  triggers: [
    {
      abilityId: 'attacks-0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Slimy Piper - ~ gets +1/+1 until end of turn. If you control four or more creatures, it gets +2/+2 and gains indestructible until end of turn instead.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
