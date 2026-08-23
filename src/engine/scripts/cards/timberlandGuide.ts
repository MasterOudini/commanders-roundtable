// `Timberland Guide` — the targeted ETB +1/+1 counter with NO 'you control'
// restriction, so it can aim at an opponent's creature too (Teyo's
// Lightshield's shape, D258, one qualifier looser). D260.

import { TIMBERLAND_GUIDE } from '../../../data/fixtures/engineCards';
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
  TIMBERLAND_GUIDE,
  'When this creature enters, put a +1/+1 counter on target creature.',
);

export const TIMBERLAND_GUIDE_SCRIPT: CardScript = {
  oracleId: TIMBERLAND_GUIDE.oracleId,
  name: TIMBERLAND_GUIDE.name,
  triggers: [
    {
      abilityId: 'etb-counter',
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
      label: () => 'Timberland Guide — put a +1/+1 counter on target creature',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          { t: 'CountersChanged', changes: [{ card: target.id, kind: '+1/+1', delta: 1 }] },
        ];
      },
    },
  ],
};
