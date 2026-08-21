// `Squall Drifter` — the Trapper tap text on a SNOW creature, behind a
// flying line (TEXT = split[1]). D252.

import { SQUALL_DRIFTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SQUALL_DRIFTER, 'Flying\n{W}, {T}: Tap target creature.');
const TEXT = PRINTED.split('\n')[1] as string;

export const SQUALL_DRIFTER_SCRIPT: CardScript = {
  oracleId: SQUALL_DRIFTER.oracleId,
  name: SQUALL_DRIFTER.name,
  activated: [
    {
      ref: `${SQUALL_DRIFTER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [target.id] }];
      },
    },
  ],
};
