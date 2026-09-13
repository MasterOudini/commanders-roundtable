// `Garruk's Packleader` - a anotherCreatureEnters trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GARRUK_S_PACKLEADER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GARRUK_S_PACKLEADER, "Whenever another creature you control with power 3 or greater enters, you may draw a card.");

export const GARRUKS_PACKLEADER_SCRIPT: CardScript = {
  oracleId: GARRUK_S_PACKLEADER.oracleId,
  name: GARRUK_S_PACKLEADER.name,
  triggers: [
    {
      abilityId: 'anotherCreatureEnters-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card !== self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature') && (ctx.derive(m.card).power ?? 0) >= 3,
        ),
      label: () => "Garruk's Packleader - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
