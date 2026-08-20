// `In Garruk's Wake` — everything I DON'T control that is a creature or
// planeswalker dies; my side never notices. D219.

import { IN_GARRUK_S_WAKE } from '../../../data/fixtures/engineCards';
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
  IN_GARRUK_S_WAKE,
  "Destroy all creatures you don't control and all planeswalkers you don't control.",
);

export const IN_GARRUKS_WAKE_SCRIPT: CardScript = {
  oracleId: IN_GARRUK_S_WAKE.oracleId,
  name: IN_GARRUK_S_WAKE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller === obj.controller) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature') && !d.typeLine.types.includes('Planeswalker'))
          continue;
        if (d.keywords.has('indestructible')) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'graveyard' as const, player: card.owner },
        });
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
