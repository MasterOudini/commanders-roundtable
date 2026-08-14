// `Law-Rune Enforcer` — "{1}, {T}: Tap target creature with mana value 2 or
// greater." The activated tap behind D139's mana-value floor. M6.4ab, D184.

import { LAW_RUNE_ENFORCER } from '../../../data/fixtures/engineCards';
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
  LAW_RUNE_ENFORCER,
  '{1}, {T}: Tap target creature with mana value 2 or greater.',
);

export const LAW_RUNE_ENFORCER_SCRIPT: CardScript = {
  oracleId: LAW_RUNE_ENFORCER.oracleId,
  name: LAW_RUNE_ENFORCER.name,
  activated: [
    {
      ref: `${LAW_RUNE_ENFORCER.oracleId}#a0`,
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
