// `Ley Druid` — "{T}: Untap target land." Juniper Order Druid's EXACT text
// on its own oracle id, in the very next batch. M6.4ab, D184.

import { LEY_DRUID } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(LEY_DRUID, '{T}: Untap target land.');

export const LEY_DRUID_SCRIPT: CardScript = {
  oracleId: LEY_DRUID.oracleId,
  name: LEY_DRUID.name,
  activated: [
    {
      ref: `${LEY_DRUID.oracleId}#a0`,
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
