// `Rage-Scarred Berserker` — "When this creature enters, target creature
// you control gets +1/+0 and gains indestructible until end of turn."
// Angelheart's targeted pump-and-keyword rider on D194's carrier. D236.

import { RAGE_SCARRED_BERSERKER } from '../../../data/fixtures/engineCards';
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
  RAGE_SCARRED_BERSERKER,
  'When this creature enters, target creature you control gets +1/+0 and gains indestructible until end of turn. ' +
    '(Damage and effects that say "destroy" don\'t destroy it.)',
);

export const RAGE_SCARRED_BERSERKER_SCRIPT: CardScript = {
  oracleId: RAGE_SCARRED_BERSERKER.oracleId,
  name: RAGE_SCARRED_BERSERKER.name,
  triggers: [
    {
      abilityId: 'etb-rage',
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
      label: () => 'Rage-Scarred Berserker — +1/+0 and indestructible',
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
            keywords: ['indestructible'],
          },
        ];
      },
    },
  ],
};
