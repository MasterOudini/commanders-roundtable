// `Luminarch Aspirant` — "At the beginning of combat on your turn, put a
// +1/+1 counter on target creature you control." Eidolon of Inspiration's
// filter with the counter payoff, asking for an aim every combat. M6.4ac,
// D185.

import { LUMINARCH_ASPIRANT } from '../../../data/fixtures/engineCards';
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
  LUMINARCH_ASPIRANT,
  'At the beginning of combat on your turn, put a +1/+1 counter on target creature you control.',
);

export const LUMINARCH_ASPIRANT_SCRIPT: CardScript = {
  oracleId: LUMINARCH_ASPIRANT.oracleId,
  name: LUMINARCH_ASPIRANT.name,
  triggers: [
    {
      abilityId: 'begin-combat',
      text: TEXT,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) =>
        ev.t === 'StepBegan' &&
        ev.step === 'beginCombat' &&
        ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => 'Luminarch Aspirant — put a +1/+1 counter on target creature you control',
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
