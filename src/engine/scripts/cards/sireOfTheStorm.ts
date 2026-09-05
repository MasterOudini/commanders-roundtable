// `Sire of the Storm` - a castSpiritOrArcane trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SIRE_OF_THE_STORM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SIRE_OF_THE_STORM, "Flying\nWhenever you cast a Spirit or Arcane spell, you may draw a card.");
const LINES = PRINTED.split('\n');

export const SIRE_OF_THE_STORM_SCRIPT: CardScript = {
  oracleId: SIRE_OF_THE_STORM.oracleId,
  name: SIRE_OF_THE_STORM.name,
  triggers: [
    {
      abilityId: 'castSpiritOrArcane-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.subtypes.some((t) => t === 'Spirit' || t === 'Arcane'),
      label: () => "Sire of the Storm - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
