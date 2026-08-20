// `Akki Drillmaster` — "{T}: Target creature gains haste until end of
// turn." The {T}-cost grant (summoning sickness gates the ACTIVATION; the
// grant itself is D194's rider). D197.

import { AKKI_DRILLMASTER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(AKKI_DRILLMASTER, '{T}: Target creature gains haste until end of turn.');

export const AKKI_DRILLMASTER_SCRIPT: CardScript = {
  oracleId: AKKI_DRILLMASTER.oracleId,
  name: AKKI_DRILLMASTER.name,
  activated: [
    {
      ref: `${AKKI_DRILLMASTER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          { t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: ['haste'] },
        ];
      },
    },
  ],
};
