// `Voltaic Key` — "{1}, {T}: Untap target artifact." Blossom Dryad's shape
// with the noun one type over, and a generic mana pip in front of the {T}.
// D267.

import { VOLTAIC_KEY } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(VOLTAIC_KEY, '{1}, {T}: Untap target artifact.');

export const VOLTAIC_KEY_SCRIPT: CardScript = {
  oracleId: VOLTAIC_KEY.oracleId,
  name: VOLTAIC_KEY.name,
  activated: [
    {
      ref: `${VOLTAIC_KEY.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || !card.tapped) return [];
        return [{ t: 'PermanentsUntapped', cards: [target.id] }];
      },
    },
  ],
};
