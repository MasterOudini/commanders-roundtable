// `Tezzeret, Betrayer of Flesh Emblem` - a becomesTapped trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TEZZERET_BETRAYER_OF_FLESH_EMBLEM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TEZZERET_BETRAYER_OF_FLESH_EMBLEM, "Whenever an artifact you control becomes tapped, draw a card.");

export const TEZZERET_BETRAYER_OF_FLESH_EMBLEMBDB4FA32_SCRIPT: CardScript = {
  oracleId: TEZZERET_BETRAYER_OF_FLESH_EMBLEM.oracleId,
  name: TEZZERET_BETRAYER_OF_FLESH_EMBLEM.name,
  triggers: [
    {
      abilityId: 'becomesTapped-0',
      text: PRINTED,
      event: 'PermanentsTapped',
      activeZones: ['command'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'PermanentsTapped' && ev.cards.some((c) => ctx.state.cards[c]?.controller === ctx.query.controllerOf(self) && ctx.derive(c).typeLine.types.includes('Artifact')),
      label: () => "Tezzeret, Betrayer of Flesh Emblem - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
