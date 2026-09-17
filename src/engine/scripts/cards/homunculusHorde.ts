// `Homunculus Horde` - a secondCard trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HOMUNCULUS_HORDE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HOMUNCULUS_HORDE, "Whenever you draw your second card each turn, create a token that's a copy of this creature.");

const VOCAB_L0 = vocabularyEffects("Create a token that's a copy of this creature.", HOMUNCULUS_HORDE.name);
const VOCAB_T_L0 = vocabularyTargets("Create a token that's a copy of this creature.");

export const HOMUNCULUS_HORDE_SCRIPT: CardScript = {
  oracleId: HOMUNCULUS_HORDE.oracleId,
  name: HOMUNCULUS_HORDE.name,
  triggers: [
    {
      abilityId: 'secondCard-0',
      text: PRINTED,
      event: 'DrewCards',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'DrewCards' && ev.player === ctx.query.controllerOf(self) && (ctx.state.turn.cardsDrawn[ev.player] ?? 0) >= 2 && (ctx.state.turn.cardsDrawn[ev.player] ?? 0) - ev.cards.length < 2,
      label: () => "Homunculus Horde - Create a token that's a copy of this creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
