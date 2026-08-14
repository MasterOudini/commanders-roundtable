// `Iron Bully` — "When this creature enters, put a +1/+1 counter on target
// creature." One of FOUR ids carrying this text in a single batch (with
// Ironpaw Aspirant, Ironshell Beetle and Jeong Jeong's Deserters) — the
// largest text family yet, each proven on its own registration. M6.4z,
// D182.

import { IRON_BULLY } from '../../../data/fixtures/engineCards';
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
  IRON_BULLY,
  "Menace (This creature can't be blocked except by two or more creatures.)\n" +
    'When this creature enters, put a +1/+1 counter on target creature.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const IRON_BULLY_SCRIPT: CardScript = {
  oracleId: IRON_BULLY.oracleId,
  name: IRON_BULLY.name,
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
      label: () => 'Iron Bully — put a +1/+1 counter on target creature',
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
