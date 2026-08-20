// `Plague Wind` — "Destroy all creatures you don't control. They can't
// be regenerated." The one-sided wipe from the OTHER side of Overwhelming
// Forces, with the vacuous regeneration clause; this module's file name
// sits in damnation.node.test.ts's exclude list. D233.

import { PLAGUE_WIND } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(PLAGUE_WIND, "Destroy all creatures you don't control. They can't be regenerated.");

export const PLAGUE_WIND_SCRIPT: CardScript = {
  oracleId: PLAGUE_WIND.oracleId,
  name: PLAGUE_WIND.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller === obj.controller) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        if (ctx.derive(id).keywords.has('indestructible')) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'graveyard' as const, player: card.owner },
        });
      }
      return moves.length > 0 ? [{ t: 'CardsMoved', moves }] : [];
    },
  },
};
