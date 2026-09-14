// `Phyrexian Tyranny` - a aPlayerDrawsCard trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PHYREXIAN_TYRANNY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PHYREXIAN_TYRANNY, "Whenever a player draws a card, that player loses 2 life unless they pay {2}.");

const VOCAB_L0 = vocabularyEffects("Target player loses 2 life unless target player pays {2}.", PHYREXIAN_TYRANNY.name);
const VOCAB_T_L0 = vocabularyTargets("Target player loses 2 life unless target player pays {2}.");

export const PHYREXIAN_TYRANNY_SCRIPT: CardScript = {
  oracleId: PHYREXIAN_TYRANNY.oracleId,
  name: PHYREXIAN_TYRANNY.name,
  triggers: [
    {
      abilityId: 'aPlayerDrawsCard-0',
      text: PRINTED,
      event: 'DrewCards',
      activeZones: ['battlefield'],
      optional: false,
      perItem: (_ctx, _self, ev) => (ev.t === 'DrewCards' ? ev.cards : []),
      playerOf: (_ctx, _self, ev) => (ev.t === 'DrewCards' ? ev.player : null),
      matches: (_ctx, _self, ev) => ev.t === 'DrewCards',
      label: () => "Phyrexian Tyranny - Target player loses 2 life unless target player pays {2}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: VOCAB_T_L0.map(() => ({ kind: 'player' as const, id: obj.player as string })) }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
