// `Chasm Drake` — "Whenever this creature attacks, target creature you
// control gains flying until end of turn." The self-attack filter with a
// targeted D194 grant. D203.

import { CHASM_DRAKE } from '../../../data/fixtures/engineCards';
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
  CHASM_DRAKE,
  'Flying\nWhenever this creature attacks, target creature you control gains flying until end of turn.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const CHASM_DRAKE_SCRIPT: CardScript = {
  oracleId: CHASM_DRAKE.oracleId,
  name: CHASM_DRAKE.name,
  triggers: [
    {
      abilityId: 'attacks-grant',
      text: TEXT,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (_ctx, self, ev) =>
        ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => 'Chasm Drake — grant flying',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          { t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: ['flying'] },
        ];
      },
    },
  ],
};
