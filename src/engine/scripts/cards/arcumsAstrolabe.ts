// `Arcum's Astrolabe` - a etb trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ARCUM_S_ASTROLABE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ARCUM_S_ASTROLABE, "({S} can be paid with one mana from a snow source.)\nWhen this artifact enters, draw a card.\n{1}, {T}: Add one mana of any color.");
const LINES = PRINTED.split('\n');

export const ARCUMS_ASTROLABE_SCRIPT: CardScript = {
  oracleId: ARCUM_S_ASTROLABE.oracleId,
  name: ARCUM_S_ASTROLABE.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Arcum's Astrolabe - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
