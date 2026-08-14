// `Jeong Jeong's Deserters` — "When this creature enters, put a +1/+1
// counter on target creature." The fourth id of the batch's four-way text
// family. M6.4z, D182.

import { JEONG_JEONG_S_DESERTERS } from '../../../data/fixtures/engineCards';
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
  JEONG_JEONG_S_DESERTERS,
  'When this creature enters, put a +1/+1 counter on target creature.',
);

export const JEONG_JEONGS_DESERTERS_SCRIPT: CardScript = {
  oracleId: JEONG_JEONG_S_DESERTERS.oracleId,
  name: JEONG_JEONG_S_DESERTERS.name,
  triggers: [
    {
      abilityId: 'etb',
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
      label: () => "Jeong Jeong's Deserters — put a +1/+1 counter on target creature",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        return ctx.state.cards[target.id]?.zone.kind === 'battlefield'
          ? [{ t: 'CountersChanged', changes: [{ card: target.id, kind: '+1/+1', delta: 1 }] }]
          : [];
      },
    },
  ],
};
