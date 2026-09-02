// `Wojek Siren` — "Radiance — Target creature and each other creature that
// shares a color with it get +1/+1 until end of turn."
//
// ⚠️ RADIANCE is a keyword-WORD prefix (an ability word: flavour, no rules
// meaning), so the def owes only what follows it. The spread is RESOLVE-side:
// one target, then every OTHER creature sharing ANY colour with it, both
// seats, colours read DERIVED. A COLOURLESS target shares a colour with
// nothing, so it pumps alone — the branch worth pinning. D270.

import { WOJEK_SIREN } from '../../../data/fixtures/engineCards';
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
  WOJEK_SIREN,
  'Radiance — Target creature and each other creature that shares a color with it get +1/+1 until end of turn.',
);

export const WOJEK_SIREN_SCRIPT: CardScript = {
  oracleId: WOJEK_SIREN.oracleId,
  name: WOJEK_SIREN.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];

      const theirColors = ctx.derive(target.id).colors;
      const events: EventBody[] = [
        { t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 1, toughness: 1, keywords: [] },
      ];

      for (const id of ctx.state.zones.battlefield) {
        if (id === target.id) continue; // "each OTHER creature"
        if (!ctx.state.cards[id]) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (!d.colors.some((c) => theirColors.includes(c))) continue;
        events.push({
          t: 'PtModifiedUntilEndOfTurn',
          card: id,
          power: 1,
          toughness: 1,
          keywords: [],
        });
      }
      return events;
    },
  },
};
