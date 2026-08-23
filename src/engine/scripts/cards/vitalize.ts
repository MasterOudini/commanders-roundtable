// `Vitalize` — untap all MY creatures, in one event. A creature already
// upright is simply not in the list. D266.

import { VITALIZE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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

const TEXT = printed(VITALIZE, 'Untap all creatures you control.');

export const VITALIZE_SCRIPT: CardScript = {
  oracleId: VITALIZE.oracleId,
  name: VITALIZE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const cards: InstanceId[] = [];
      for (const id of ctx.state.zones.battlefield) {
        const inst = ctx.state.cards[id];
        if (!inst || inst.controller !== obj.controller || !inst.tapped) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        cards.push(id);
      }
      if (cards.length === 0) return [];
      return [{ t: 'PermanentsUntapped', cards }];
    },
  },
};
