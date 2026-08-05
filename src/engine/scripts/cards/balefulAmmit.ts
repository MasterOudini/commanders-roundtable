// `Baleful Ammit` — "Lifelink\nWhen this creature enters, put a -1/-1
// counter on target creature you control." Backup Agent's shape with the
// OTHER counter kind derive sums at layer 7d, and a "you control" restriction
// the targeting layer enforces. The Ammit itself is a legal target. M6.4f,
// D163.

import { BALEFUL_AMMIT } from '../../../data/fixtures/engineCards';
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
  BALEFUL_AMMIT,
  'Lifelink\nWhen this creature enters, put a -1/-1 counter on target creature you control.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const BALEFUL_AMMIT_SCRIPT: CardScript = {
  oracleId: BALEFUL_AMMIT.oracleId,
  name: BALEFUL_AMMIT.name,
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
      label: () => 'Baleful Ammit — -1/-1 counter on target creature you control',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        return ctx.state.cards[target.id]?.zone.kind === 'battlefield'
          ? [{ t: 'CountersChanged', changes: [{ card: target.id, kind: '-1/-1', delta: 1 }] }]
          : [];
      },
    },
  ],
};
