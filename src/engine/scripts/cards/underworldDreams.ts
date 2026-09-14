// `Underworld Dreams` - a opponentDrawsCard trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { UNDERWORLD_DREAMS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(UNDERWORLD_DREAMS, "Whenever an opponent draws a card, this enchantment deals 1 damage to that player.");

const VOCAB_L0 = vocabularyEffects("This enchantment deals 1 damage to target player.", UNDERWORLD_DREAMS.name);
const VOCAB_T_L0 = vocabularyTargets("This enchantment deals 1 damage to target player.");

export const UNDERWORLD_DREAMS_SCRIPT: CardScript = {
  oracleId: UNDERWORLD_DREAMS.oracleId,
  name: UNDERWORLD_DREAMS.name,
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
      label: () => "Underworld Dreams - This enchantment deals 1 damage to target player.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: VOCAB_T_L0.map(() => ({ kind: 'player' as const, id: obj.player as string })) }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
