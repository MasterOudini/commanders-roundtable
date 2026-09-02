// `Blinding Spray` — "Creatures your opponents control get -4/-0 until end
// of turn.\nDraw a card." Drown in Sorrow's board sweep (D209) narrowed to
// the creatures every OPPONENT controls — mine are untouched — then the
// draw. Power may go negative; the engine derives it as printed. D273.

import { BLINDING_SPRAY } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(BLINDING_SPRAY, 'Creatures your opponents control get -4/-0 until end of turn.\nDraw a card.');

export const BLINDING_SPRAY_SCRIPT: CardScript = {
  oracleId: BLINDING_SPRAY.oracleId,
  name: BLINDING_SPRAY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller === obj.controller) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: id, power: -4, toughness: 0, keywords: [] });
      }
      events.push(...drawEvents(ctx.state, obj.controller, 1));
      return events;
    },
  },
};
