// `Storm Fleet Spy` - a raidEtb trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STORM_FLEET_SPY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STORM_FLEET_SPY, "Raid — When this creature enters, if you attacked this turn, draw a card.");

export const STORM_FLEET_SPY_SCRIPT: CardScript = {
  oracleId: STORM_FLEET_SPY.oracleId,
  name: STORM_FLEET_SPY.name,
  triggers: [
    {
      abilityId: 'raidEtb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' && ctx.state.turn.attacked && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Storm Fleet Spy - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
