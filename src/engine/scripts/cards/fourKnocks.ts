// `Four Knocks` - a firstMainPhase trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FOUR_KNOCKS } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
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

const PRINTED = printed(FOUR_KNOCKS, "Vanishing 4 (This enchantment enters with four time counters on it. At the beginning of your upkeep, remove a time counter from it. When the last is removed, sacrifice it.)\nAt the beginning of your first main phase, draw a card.");
const LINES = PRINTED.split('\n');

export const FOUR_KNOCKS_SCRIPT: CardScript = {
  oracleId: FOUR_KNOCKS.oracleId,
  name: FOUR_KNOCKS.name,
  triggers: [
    {
      abilityId: 'firstMainPhase-1',
      text: LINES[1] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'precombatMain' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Four Knocks - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
