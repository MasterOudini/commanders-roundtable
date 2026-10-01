// `Star-Crowned Stag` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STAR_CROWNED_STAG } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STAR_CROWNED_STAG, "Whenever this creature attacks, tap target creature defending player controls.");

const VOCAB_L0 = vocabularyEffects("Tap target creature defending player controls.", STAR_CROWNED_STAG.name);
const VOCAB_T_L0 = vocabularyTargets("Tap target creature defending player controls.");

export const STAR_CROWNED_STAG_SCRIPT: CardScript = {
  oracleId: STAR_CROWNED_STAG.oracleId,
  name: STAR_CROWNED_STAG.name,
  triggers: [
    {
      abilityId: 'attacks-0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Star-Crowned Stag - Tap target creature defending player controls.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
