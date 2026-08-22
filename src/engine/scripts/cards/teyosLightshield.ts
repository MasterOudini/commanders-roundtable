// `Teyo's Lightshield` — the targeted ETB +1/+1 COUNTER (a permanent change,
// where Tenth District Guard's is until end of turn). The 'you control'
// restriction is enforced at the aim. D258.

import { TEYO_S_LIGHTSHIELD } from '../../../data/fixtures/engineCards';
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
  TEYO_S_LIGHTSHIELD,
  'When this creature enters, put a +1/+1 counter on target creature you control.',
);

export const TEYOS_LIGHTSHIELD_SCRIPT: CardScript = {
  oracleId: TEYO_S_LIGHTSHIELD.oracleId,
  name: TEYO_S_LIGHTSHIELD.name,
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
      label: () => "Teyo's Lightshield — put a +1/+1 counter on target creature you control",
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
