// `Double Trouble` — "Double the power of each creature you control until
// end of turn." Doubling is a computed per-creature DELTA: +power equal to
// the derived power right now (a 0-power creature gains nothing, a
// negative-power one is left alone rather than halved further). D209.

import { DOUBLE_TROUBLE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  DOUBLE_TROUBLE,
  'Double the power of each creature you control until end of turn.',
);

export const DOUBLE_TROUBLE_SCRIPT: CardScript = {
  oracleId: DOUBLE_TROUBLE.oracleId,
  name: DOUBLE_TROUBLE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        const power = d.power ?? 0;
        if (power <= 0) continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: id, power, toughness: 0 });
      }
      return events;
    },
  },
};
