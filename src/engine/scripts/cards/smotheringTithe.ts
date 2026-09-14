// `Smothering Tithe` - a opponentDrawsCard trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SMOTHERING_TITHE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SMOTHERING_TITHE, "Whenever an opponent draws a card, that player may pay {2}. If the player doesn't, you create a Treasure token. (It's an artifact with \"{T}, Sacrifice this token: Add one mana of any color.\")");

const VOCAB_L0 = vocabularyEffects("Target player may pay {2}. If the player doesn't, you create a Treasure token.", SMOTHERING_TITHE.name);
const VOCAB_T_L0 = vocabularyTargets("Target player may pay {2}. If the player doesn't, you create a Treasure token.");

export const SMOTHERING_TITHE_SCRIPT: CardScript = {
  oracleId: SMOTHERING_TITHE.oracleId,
  name: SMOTHERING_TITHE.name,
  triggers: [
    {
      abilityId: 'opponentDrawsCard-0',
      text: PRINTED,
      event: 'DrewCards',
      activeZones: ['battlefield'],
      optional: false,
      perItem: (_ctx, _self, ev) => (ev.t === 'DrewCards' ? ev.cards : []),
      playerOf: (_ctx, _self, ev) => (ev.t === 'DrewCards' ? ev.player : null),
      matches: (ctx, self, ev) => ev.t === 'DrewCards' && ev.player !== ctx.query.controllerOf(self),
      label: () => "Smothering Tithe - Target player may pay {2}. If the player doesn't, you create a Treasure token.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: VOCAB_T_L0.map(() => ({ kind: 'player' as const, id: obj.player as string })) }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
