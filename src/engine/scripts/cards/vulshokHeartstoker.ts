// `Vulshok Heartstoker` — the targeted ETB +2/+0.
//
// ⚠️ POWER ONLY: toughness is untouched, so a pumped 2/2 still TRADES with a
// 2/2 (D255's correction, which cost a test its first reading). D267.

import { VULSHOK_HEARTSTOKER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  VULSHOK_HEARTSTOKER,
  'When this creature enters, target creature gets +2/+0 until end of turn.',
);

export const VULSHOK_HEARTSTOKER_SCRIPT: CardScript = {
  oracleId: VULSHOK_HEARTSTOKER.oracleId,
  name: VULSHOK_HEARTSTOKER.name,
  triggers: [
    {
      abilityId: 'etb-pump',
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
      label: () => 'Vulshok Heartstoker — target creature gets +2/+0',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          {
            t: 'PtModifiedUntilEndOfTurn',
            card: target.id,
            power: 2,
            toughness: 0,
            keywords: [],
          },
        ];
      },
    },
  ],
};
