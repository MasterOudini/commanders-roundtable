// `Cavalry Drillmaster` — "When this creature enters, target creature gets
// +2/+0 and gains first strike until end of turn." Arborea Pegasus's
// targeted ETB grant, one keyword over. D202.

import { CAVALRY_DRILLMASTER } from '../../../data/fixtures/engineCards';
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
  CAVALRY_DRILLMASTER,
  'When this creature enters, target creature gets +2/+0 and gains first strike until end of turn. (It deals combat damage before creatures without first strike.)',
);

export const CAVALRY_DRILLMASTER_SCRIPT: CardScript = {
  oracleId: CAVALRY_DRILLMASTER.oracleId,
  name: CAVALRY_DRILLMASTER.name,
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
      label: () => 'Cavalry Drillmaster — +2/+0 and first strike',
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
            keywords: ['firstStrike'],
          },
        ];
      },
    },
  ],
};
