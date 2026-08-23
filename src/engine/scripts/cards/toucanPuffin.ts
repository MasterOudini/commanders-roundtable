// `Toucan-Puffin` — flying plus a targeted ETB pump on a creature I control.
// The keyword line never counts, so the def's text is `split[1]`, and the
// "you control" restriction is ENFORCED at the aim (probed on Tolarian
// Sentinel's identical clause). D261.

import { TOUCAN_PUFFIN } from '../../../data/fixtures/engineCards';
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
  TOUCAN_PUFFIN,
  'Flying\nWhen this creature enters, target creature you control gets +2/+0 until end of turn.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const TOUCAN_PUFFIN_SCRIPT: CardScript = {
  oracleId: TOUCAN_PUFFIN.oracleId,
  name: TOUCAN_PUFFIN.name,
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
      label: () => 'Toucan-Puffin — target creature you control gets +2/+0',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 0 }];
      },
    },
  ],
};
