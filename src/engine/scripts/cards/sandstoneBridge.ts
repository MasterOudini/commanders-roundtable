// `Sandstone Bridge` — the three-line land whose ETB trigger TARGETS: a
// +1/+1-and-vigilance ride on D194's carrier, behind the tapped built-in
// and the engine's mana line. Looming Spires with vigilance. D243.

import { SANDSTONE_BRIDGE } from '../../../data/fixtures/engineCards';
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
  SANDSTONE_BRIDGE,
  'This land enters tapped.\nWhen this land enters, target creature gets +1/+1 and gains vigilance until end of turn.\n{T}: Add {W}.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const SANDSTONE_BRIDGE_SCRIPT: CardScript = {
  oracleId: SANDSTONE_BRIDGE.oracleId,
  name: SANDSTONE_BRIDGE.name,
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
      label: () => 'Sandstone Bridge — +1/+1 and vigilance',
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
            keywords: ['vigilance'],
          },
        ];
      },
    },
  ],
};
