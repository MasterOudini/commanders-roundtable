// `Thornscape Apprentice` — {R} and the tap grant first strike; {W} and the
// tap tap a creature.

import { THORNSCAPE_APPRENTICE } from '../../../data/fixtures/engineCards';
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
  THORNSCAPE_APPRENTICE,
  '{R}, {T}: Target creature gains first strike until end of turn.\n{W}, {T}: Tap target creature.',
);
const FIRST_STRIKE = PRINTED.split('\n')[0] as string;
const TAP = PRINTED.split('\n')[1] as string;

export const THORNSCAPE_APPRENTICE_SCRIPT: CardScript = {
  oracleId: THORNSCAPE_APPRENTICE.oracleId,
  name: THORNSCAPE_APPRENTICE.name,
  activated: [
    {
      ref: `${THORNSCAPE_APPRENTICE.oracleId}#a0`,
      text: FIRST_STRIKE,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: ['firstStrike'] }];
      },
    },
    {
      ref: `${THORNSCAPE_APPRENTICE.oracleId}#a1`,
      text: TAP,
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
