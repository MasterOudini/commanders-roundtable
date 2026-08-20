// `Pith Driller` — "When this creature enters, put a -1/-1 counter on
// target creature." Ornery Kudu's targeted counter behind a Phyrexian
// cast cost; the reminder line is the cost's, not the trigger's. D233.

import { PITH_DRILLER } from '../../../data/fixtures/engineCards';
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
  PITH_DRILLER,
  '({B/P} can be paid with either {B} or 2 life.)\nWhen this creature enters, put a -1/-1 counter on target creature.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const PITH_DRILLER_SCRIPT: CardScript = {
  oracleId: PITH_DRILLER.oracleId,
  name: PITH_DRILLER.name,
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
      label: () => 'Pith Driller — put a -1/-1 counter on target creature',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: target.id, kind: '-1/-1', delta: 1 }] }];
      },
    },
  ],
};
