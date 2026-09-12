// `Archmage of Runes` - a castInstantSorcery trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ARCHMAGE_OF_RUNES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ARCHMAGE_OF_RUNES, "Instant and sorcery spells you cast cost {1} less to cast.\nWhenever you cast an instant or sorcery spell, draw a card.");
const LINES = PRINTED.split('\n');

export const ARCHMAGE_OF_RUNES_SCRIPT: CardScript = {
  oracleId: ARCHMAGE_OF_RUNES.oracleId,
  name: ARCHMAGE_OF_RUNES.name,
  triggers: [
    {
      abilityId: 'castInstantSorcery-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.some((t) => t === 'Instant' || t === 'Sorcery'),
      label: () => "Archmage of Runes - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
