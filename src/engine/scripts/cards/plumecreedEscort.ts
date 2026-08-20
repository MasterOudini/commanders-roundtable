// `Plumecreed Escort` — "When this creature enters, target creature you
// control gains hexproof until end of turn." The targeted ETB grant
// carrying a Tier-2 keyword the aim layer consults derived (D129); the
// Flash and Flying lines are the engine's. D234.

import { PLUMECREED_ESCORT } from '../../../data/fixtures/engineCards';
import { parseTargetClauses } from '../../../data/targetParse';
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

const PRINTED = printed(
  PLUMECREED_ESCORT,
  'Flash\nFlying\nWhen this creature enters, target creature you control gains hexproof until end of turn.',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const PLUMECREED_ESCORT_SCRIPT: CardScript = {
  oracleId: PLUMECREED_ESCORT.oracleId,
  name: PLUMECREED_ESCORT.name,
  triggers: [
    {
      abilityId: 'etb-hexproof',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Plumecreed Escort — a creature you control gains hexproof',
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
            keywords: ['hexproof'],
          },
        ];
      },
    },
  ],
};
