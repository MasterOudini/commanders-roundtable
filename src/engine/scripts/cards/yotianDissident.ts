// `Yotian Dissident` — "Whenever an artifact you control enters, put a +1/+1
// counter on target creature you control." The first TARGETED trigger (D147)
// ships for real (M6.4c, D160): the testing copy this replaced proved the
// machinery; one card, one script.
//
// ⚠️ Shipping it forced a deliberate teeth swap in
// `shippedScripts.node.test.ts` — Yotian was half of the "a test script must
// FAIL the gate" pair, and a shipped card cannot be the example of an
// unshipped one. `Humility` holds that post now.

import { YOTIAN_DISSIDENT } from '../../../data/fixtures/engineCards';
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
  YOTIAN_DISSIDENT,
  'Whenever an artifact you control enters, put a +1/+1 counter on target creature you control.',
);

export const YOTIAN_DISSIDENT_SCRIPT: CardScript = {
  oracleId: YOTIAN_DISSIDENT.oracleId,
  name: YOTIAN_DISSIDENT.name,
  triggers: [
    {
      abilityId: 'artifact-etb',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) => {
        if (ev.t !== 'CardsMoved') return false;
        const mine = ctx.query.controllerOf(self);
        return ev.moves.some((m) => {
          if (m.to.kind !== 'battlefield' || m.from.kind === 'battlefield') return false;
          const card = ctx.state.cards[m.card];
          if (!card || card.controller !== mine) return false;
          return ctx.derive(m.card).typeLine.types.includes('Artifact');
        });
      },
      label: () => 'Yotian Dissident — +1/+1 counter on target creature you control',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        // Re-checked at resolution (CR 603.2): a counter on a graveyard card
        // is a number nothing reads.
        return ctx.state.cards[target.id]?.zone.kind === 'battlefield'
          ? [{ t: 'CountersChanged', changes: [{ card: target.id, kind: '+1/+1', delta: 1 }] }]
          : [];
      },
    },
  ],
};
