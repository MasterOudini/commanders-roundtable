// `Teetering Peaks` — Looming Spires' targeted ETB trigger on a LAND (D222),
// with the tapped entry as D134's built-in and the mana line the engine's.
// The def claims only the trigger. D257.

import { TEETERING_PEAKS } from '../../../data/fixtures/engineCards';
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
  TEETERING_PEAKS,
  'This land enters tapped.\nWhen this land enters, target creature gets +2/+0 until end of turn.\n{T}: Add {R}.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const TEETERING_PEAKS_SCRIPT: CardScript = {
  oracleId: TEETERING_PEAKS.oracleId,
  name: TEETERING_PEAKS.name,
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
      label: () => 'Teetering Peaks — target creature gets +2/+0',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 0 }];
      },
    },
  ],
};
