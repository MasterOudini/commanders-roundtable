// `Yeva's Forcemage` — the targeted ETB +2/+2. ⚠️ Apostrophe card: the
// fixture const is YEVA_S_FORCEMAGE, the file-derived export is
// YEVAS_FORCEMAGE_SCRIPT (D215/D267). D271.

import { YEVA_S_FORCEMAGE } from '../../../data/fixtures/engineCards';
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
  YEVA_S_FORCEMAGE,
  'When this creature enters, target creature gets +2/+2 until end of turn.',
);

export const YEVAS_FORCEMAGE_SCRIPT: CardScript = {
  oracleId: YEVA_S_FORCEMAGE.oracleId,
  name: YEVA_S_FORCEMAGE.name,
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
      label: () => "Yeva's Forcemage — target creature gets +2/+2",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          { t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 2, keywords: [] },
        ];
      },
    },
  ],
};
