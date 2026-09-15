// `Urza's Blueprints` - an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { URZA_S_BLUEPRINTS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(URZA_S_BLUEPRINTS, "Echo {6} (At the beginning of your upkeep, if this came under your control since the beginning of your last upkeep, sacrifice it unless you pay its echo cost.)\n{T}: Draw a card.");
const LINES = PRINTED.split('\n');

export const URZAS_BLUEPRINTS_SCRIPT: CardScript = {
  oracleId: URZA_S_BLUEPRINTS.oracleId,
  name: URZA_S_BLUEPRINTS.name,
  activated: [
    {
      ref: `${URZA_S_BLUEPRINTS.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
