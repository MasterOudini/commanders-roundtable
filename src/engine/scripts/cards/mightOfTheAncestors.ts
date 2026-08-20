// `Might of the Ancestors` — "At the beginning of combat on your turn,
// target creature you control gets +2/+0 and gains vigilance until end of
// turn." Blood Mist's begin-combat targeted trigger carrying a P/T bonus AND
// the D194 keyword rider in one entry. D224.

import { MIGHT_OF_THE_ANCESTORS } from '../../../data/fixtures/engineCards';
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
  MIGHT_OF_THE_ANCESTORS,
  'At the beginning of combat on your turn, target creature you control gets +2/+0 and gains vigilance until end of turn.',
);

export const MIGHT_OF_THE_ANCESTORS_SCRIPT: CardScript = {
  oracleId: MIGHT_OF_THE_ANCESTORS.oracleId,
  name: MIGHT_OF_THE_ANCESTORS.name,
  triggers: [
    {
      abilityId: 'begin-combat-pump',
      text: TEXT,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) =>
        ev.t === 'StepBegan' &&
        ev.step === 'beginCombat' &&
        ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => 'Might of the Ancestors — +2/+0 and vigilance',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          {
            t: 'PtModifiedUntilEndOfTurn',
            card: target.id,
            power: 2,
            toughness: 0,
            keywords: ['vigilance'],
          },
        ];
      },
    },
  ],
};
