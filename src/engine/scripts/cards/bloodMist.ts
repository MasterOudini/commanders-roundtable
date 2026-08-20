// `Blood Mist` — "At the beginning of combat on your turn, target creature
// you control gains double strike until end of turn." Eidolon of
// Inspiration's begin-combat filter (StepBegan + the ACTIVE player is my
// controller) carrying the D194 rider, on an ENCHANTMENT. D200.

import { BLOOD_MIST } from '../../../data/fixtures/engineCards';
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
  BLOOD_MIST,
  'At the beginning of combat on your turn, target creature you control gains double strike until end of turn.',
);

export const BLOOD_MIST_SCRIPT: CardScript = {
  oracleId: BLOOD_MIST.oracleId,
  name: BLOOD_MIST.name,
  triggers: [
    {
      abilityId: 'begin-combat-grant',
      text: TEXT,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) =>
        ev.t === 'StepBegan' &&
        ev.step === 'beginCombat' &&
        ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => 'Blood Mist — grant double strike',
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
            keywords: ['doubleStrike'],
          },
        ];
      },
    },
  ],
};
