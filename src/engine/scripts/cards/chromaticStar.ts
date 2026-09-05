// `Chromatic Star` - a auraToGraveyard trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CHROMATIC_STAR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CHROMATIC_STAR, "{1}, {T}, Sacrifice this artifact: Add one mana of any color.\nWhen this artifact is put into a graveyard from the battlefield, draw a card.");
const LINES = PRINTED.split('\n');

export const CHROMATIC_STAR_SCRIPT: CardScript = {
  oracleId: CHROMATIC_STAR.oracleId,
  name: CHROMATIC_STAR.name,
  triggers: [
    {
      abilityId: 'auraToGraveyard-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Chromatic Star - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
