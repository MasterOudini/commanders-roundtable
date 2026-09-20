// `On the Trail` - a secondCard trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ON_THE_TRAIL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ON_THE_TRAIL, "Whenever you draw your second card each turn, you may put a land card from your hand onto the battlefield tapped.");

const VOCAB_L0 = vocabularyEffects("Put a land card from your hand onto the battlefield tapped.", ON_THE_TRAIL.name);
const VOCAB_T_L0 = vocabularyTargets("Put a land card from your hand onto the battlefield tapped.");

export const ON_THE_TRAIL_SCRIPT: CardScript = {
  oracleId: ON_THE_TRAIL.oracleId,
  name: ON_THE_TRAIL.name,
  triggers: [
    {
      abilityId: 'secondCard-0',
      text: PRINTED,
      event: 'DrewCards',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) =>
        ev.t === 'DrewCards' && ev.player === ctx.query.controllerOf(self) && (ctx.state.turn.cardsDrawn[ev.player] ?? 0) >= 2 && (ctx.state.turn.cardsDrawn[ev.player] ?? 0) - ev.cards.length < 2,
      label: () => "On the Trail - Put a land card from your hand onto the battlefield tapped.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
