// `Errant Doomsayers` — "{T}: Tap target creature with toughness 2 or
// less." Ephara's Warden one attribute over — D139 reads toughness the same
// way it reads power. M6.4q, D173.

import { ERRANT_DOOMSAYERS } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(ERRANT_DOOMSAYERS, '{T}: Tap target creature with toughness 2 or less.');

export const ERRANT_DOOMSAYERS_SCRIPT: CardScript = {
  oracleId: ERRANT_DOOMSAYERS.oracleId,
  name: ERRANT_DOOMSAYERS.name,
  activated: [
    {
      ref: `${ERRANT_DOOMSAYERS.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [target.id] }];
      },
    },
  ],
};
