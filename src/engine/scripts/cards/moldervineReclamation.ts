// `Moldervine Reclamation` - a creatureYouControlDies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MOLDERVINE_RECLAMATION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MOLDERVINE_RECLAMATION, "Whenever a creature you control dies, you gain 1 life and draw a card.");

const VOCAB_L0 = vocabularyEffects("You gain 1 life and draw a card.", MOLDERVINE_RECLAMATION.name);
const VOCAB_T_L0 = vocabularyTargets("You gain 1 life and draw a card.");

export const MOLDERVINE_RECLAMATION_SCRIPT: CardScript = {
  oracleId: MOLDERVINE_RECLAMATION.oracleId,
  name: MOLDERVINE_RECLAMATION.name,
  triggers: [
    {
      abilityId: 'creatureYouControlDies-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature'),
        ),
      label: () => "Moldervine Reclamation - You gain 1 life and draw a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
