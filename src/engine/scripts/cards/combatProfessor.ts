// `Combat Professor` — "At the beginning of combat on your turn, target
// creature you control gets +1/+0 and gains vigilance until end of turn."
// Blood Mist's begin-combat filter on a creature. D204.

import { COMBAT_PROFESSOR } from '../../../data/fixtures/engineCards';
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
  COMBAT_PROFESSOR,
  'Flying\nAt the beginning of combat on your turn, target creature you control gets +1/+0 and gains vigilance until end of turn.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const COMBAT_PROFESSOR_SCRIPT: CardScript = {
  oracleId: COMBAT_PROFESSOR.oracleId,
  name: COMBAT_PROFESSOR.name,
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
      label: () => 'Combat Professor — +1/+0 and vigilance',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          {
            t: 'PtModifiedUntilEndOfTurn',
            card: target.id,
            power: 1,
            toughness: 0,
            keywords: ['vigilance'],
          },
        ];
      },
    },
  ],
};
