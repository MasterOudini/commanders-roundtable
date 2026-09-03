// `Merfolk Seastalkers` — Islandwalk is the engine's; the ability taps a
// creature WITHOUT flying (D289).

import { MERFOLK_SEASTALKERS } from '../../../data/fixtures/engineCards';
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
  MERFOLK_SEASTALKERS,
  "Islandwalk (This creature can't be blocked as long as defending player controls an Island.)\n{2}{U}: Tap target creature without flying.",
);
const TEXT = PRINTED.split('\n')[1] as string;

export const MERFOLK_SEASTALKERS_SCRIPT: CardScript = {
  oracleId: MERFOLK_SEASTALKERS.oracleId,
  name: MERFOLK_SEASTALKERS.name,
  activated: [
    {
      ref: `${MERFOLK_SEASTALKERS.oracleId}#a0`,
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
