// `Veteran's Reflexes` — +1/+1 AND an untap in one resolve (Ornamental
// Courage's shape, D230). An already-upright target gets the pump and no
// untap event, which is the branch worth pinning. D265.

import { VETERAN_S_REFLEXES } from '../../../data/fixtures/engineCards';
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
  VETERAN_S_REFLEXES,
  'Target creature gets +1/+1 until end of turn. Untap that creature.',
);

export const VETERANS_REFLEXES_SCRIPT: CardScript = {
  oracleId: VETERAN_S_REFLEXES.oracleId,
  name: VETERAN_S_REFLEXES.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (card?.zone.kind !== 'battlefield') return [];
      const events: EventBody[] = [
        { t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 1, toughness: 1 },
      ];
      if (card.tapped) events.push({ t: 'PermanentsUntapped', cards: [target.id] });
      return events;
    },
  },
};
