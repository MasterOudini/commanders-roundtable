// `Smothering Abomination` - a upkeep trigger vocab, a youSacrifice trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SMOTHERING_ABOMINATION } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(SMOTHERING_ABOMINATION, "Devoid (This card has no color.)\nFlying\nAt the beginning of your upkeep, sacrifice a creature.\nWhenever you sacrifice a creature, draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Sacrifice a creature.", SMOTHERING_ABOMINATION.name);
const VOCAB_T_L2 = vocabularyTargets("Sacrifice a creature.");

export const SMOTHERING_ABOMINATION_SCRIPT: CardScript = {
  oracleId: SMOTHERING_ABOMINATION.oracleId,
  name: SMOTHERING_ABOMINATION.name,
  triggers: [
    {
      abilityId: 'upkeep-2',
      text: LINES[2] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Smothering Abomination - Sacrifice a creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
    {
      abilityId: 'youSacrifice-3',
      text: LINES[3] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.reason === 'sacrifice' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature'),
        ),
      label: () => "Smothering Abomination - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
