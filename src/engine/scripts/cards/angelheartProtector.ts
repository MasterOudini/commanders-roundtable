// `Angelheart Protector` — "When this creature enters, target creature you
// control gains indestructible until end of turn." The D147 targeted
// trigger carrying D194's rider. D197.

import { ANGELHEART_PROTECTOR } from '../../../data/fixtures/engineCards';
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
  ANGELHEART_PROTECTOR,
  'When this creature enters, target creature you control gains indestructible until end of turn. (Damage and effects that say "destroy" don\'t destroy it.)',
);

export const ANGELHEART_PROTECTOR_SCRIPT: CardScript = {
  oracleId: ANGELHEART_PROTECTOR.oracleId,
  name: ANGELHEART_PROTECTOR.name,
  triggers: [
    {
      abilityId: 'etb-grant',
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
      label: () => 'Angelheart Protector — grant indestructible',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          { t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: ['indestructible'] },
        ];
      },
    },
  ],
};
