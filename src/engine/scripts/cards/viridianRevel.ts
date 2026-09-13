// `Viridian Revel` - a cardPutIntoGraveyard trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VIRIDIAN_REVEL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VIRIDIAN_REVEL, "Whenever an artifact is put into an opponent's graveyard from the battlefield, you may draw a card.");

export const VIRIDIAN_REVEL_SCRIPT: CardScript = {
  oracleId: VIRIDIAN_REVEL.oracleId,
  name: VIRIDIAN_REVEL.name,
  triggers: [
    {
      abilityId: 'cardPutIntoGraveyard-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'graveyard' && m.from.kind === 'battlefield' && m.to.player !== ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Artifact'),
        ),
      label: () => "Viridian Revel - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
