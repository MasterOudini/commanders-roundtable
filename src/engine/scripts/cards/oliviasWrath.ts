// `Olivia's Wrath` — "Each non-Vampire creature gets -X/-X until end of
// turn, where X is the number of Vampires you control." Mutilate's census
// with the subtype exemption. D229.

import { OLIVIA_S_WRATH } from '../../../data/fixtures/engineCards';
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
  OLIVIA_S_WRATH,
  "Each non-Vampire creature gets -X/-X until end of turn, where X is the number of Vampires you control.",
);

export const OLIVIAS_WRATH_SCRIPT: CardScript = {
  oracleId: OLIVIA_S_WRATH.oracleId,
  name: OLIVIA_S_WRATH.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      let x = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        if (!ctx.derive(id).typeLine.subtypes.includes('Vampire')) continue;
        x++;
      }
      if (x === 0) return [];
      const events: EventBody[] = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (d.typeLine.subtypes.includes('Vampire')) continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: id, power: -x, toughness: -x });
      }
      return events;
    },
  },
};
