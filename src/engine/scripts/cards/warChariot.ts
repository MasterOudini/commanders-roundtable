// `War Chariot` — "{3}, {T}: Target creature gains trample until end of
// turn." A Tier-2 keyword grant on D194's carrier; trample is in the closed
// GRANTABLE map, so the combat rules read it for free. D267.

import { WAR_CHARIOT } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(WAR_CHARIOT, '{3}, {T}: Target creature gains trample until end of turn.');

export const WAR_CHARIOT_SCRIPT: CardScript = {
  oracleId: WAR_CHARIOT.oracleId,
  name: WAR_CHARIOT.name,
  activated: [
    {
      ref: `${WAR_CHARIOT.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          {
            t: 'PtModifiedUntilEndOfTurn',
            card: target.id,
            power: 0,
            toughness: 0,
            keywords: ['trample'],
          },
        ];
      },
    },
  ],
};
