// `Ghost Warden` — "{T}: Target creature gets +1/+1 until end of turn." The
// tap-cost pump active, through layer 7c with the end-of-turn cleanup. M6.4t,
// D176.

import { GHOST_WARDEN } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(GHOST_WARDEN, '{T}: Target creature gets +1/+1 until end of turn.');

export const GHOST_WARDEN_SCRIPT: CardScript = {
  oracleId: GHOST_WARDEN.oracleId,
  name: GHOST_WARDEN.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${GHOST_WARDEN.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 1, toughness: 1 }];
      },
    },
  ],
};
