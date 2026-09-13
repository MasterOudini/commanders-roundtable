// `Geth's Grimoire` - a opponentDiscards trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GETH_S_GRIMOIRE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GETH_S_GRIMOIRE, "Whenever an opponent discards a card, you may draw a card.");

export const GETHS_GRIMOIRE_SCRIPT: CardScript = {
  oracleId: GETH_S_GRIMOIRE.oracleId,
  name: GETH_S_GRIMOIRE.name,
  triggers: [
    {
      abilityId: 'opponentDiscards-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.reason === 'discard' && m.from.kind === 'hand' && m.from.player !== ctx.query.controllerOf(self),
        ),
      label: () => "Geth's Grimoire - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
