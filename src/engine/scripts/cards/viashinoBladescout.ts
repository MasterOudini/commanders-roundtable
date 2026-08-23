// `Viashino Bladescout` — flash line plus a targeted ETB FIRST STRIKE grant
// on D194's carrier. The keyword line never counts, so the def's text is
// `split[1]`. D266.

import { VIASHINO_BLADESCOUT } from '../../../data/fixtures/engineCards';
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
  VIASHINO_BLADESCOUT,
  'Flash (You may cast this spell any time you could cast an instant.)\nWhen this creature enters, target creature gains first strike until end of turn.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const VIASHINO_BLADESCOUT_SCRIPT: CardScript = {
  oracleId: VIASHINO_BLADESCOUT.oracleId,
  name: VIASHINO_BLADESCOUT.name,
  triggers: [
    {
      abilityId: 'etb-first-strike',
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
      label: () => 'Viashino Bladescout — target creature gains first strike',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          {
            t: 'PtModifiedUntilEndOfTurn',
            card: target.id,
            power: 0,
            toughness: 0,
            keywords: ['firstStrike'],
          },
        ];
      },
    },
  ],
};
