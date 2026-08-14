// `Juniper Order Druid` — "{T}: Untap target land." The targeted untap with
// a LAND spec. M6.4aa, D183.

import { JUNIPER_ORDER_DRUID } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(JUNIPER_ORDER_DRUID, '{T}: Untap target land.');

export const JUNIPER_ORDER_DRUID_SCRIPT: CardScript = {
  oracleId: JUNIPER_ORDER_DRUID.oracleId,
  name: JUNIPER_ORDER_DRUID.name,
  activated: [
    {
      ref: `${JUNIPER_ORDER_DRUID.oracleId}#a0`,
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
