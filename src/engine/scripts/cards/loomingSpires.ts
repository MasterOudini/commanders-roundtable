// `Looming Spires` — three printed lines: enters-tapped is D134's
// built-in, the mana line the engine's, and the def claims the targeted
// ETB pump-and-grant. D222.

import { LOOMING_SPIRES } from '../../../data/fixtures/engineCards';
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
  LOOMING_SPIRES,
  'This land enters tapped.\nWhen this land enters, target creature gets +1/+1 and gains first strike until end of turn.\n{T}: Add {R}.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const LOOMING_SPIRES_SCRIPT: CardScript = {
  oracleId: LOOMING_SPIRES.oracleId,
  name: LOOMING_SPIRES.name,
  triggers: [
    {
      abilityId: 'etb-pump',
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
      label: () => 'Looming Spires — +1/+1 and first strike',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          {
            t: 'PtModifiedUntilEndOfTurn',
            card: target.id,
            power: 1,
            toughness: 1,
            keywords: ['firstStrike'],
          },
        ];
      },
    },
  ],
};
