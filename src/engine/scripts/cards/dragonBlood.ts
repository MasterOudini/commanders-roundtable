// `Dragon Blood` — "{3}, {T}: Put a +1/+1 counter on target creature." A
// repeatable targeted counter with no sacrifice anywhere — Deranged Outcast's
// resolve on an artifact that stays. M6.4p, D172.

import { DRAGON_BLOOD } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(DRAGON_BLOOD, '{3}, {T}: Put a +1/+1 counter on target creature.');

export const DRAGON_BLOOD_SCRIPT: CardScript = {
  oracleId: DRAGON_BLOOD.oracleId,
  name: DRAGON_BLOOD.name,
  activated: [
    {
      ref: `${DRAGON_BLOOD.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: target.id, kind: '+1/+1', delta: 1 }] }];
      },
    },
  ],
};
