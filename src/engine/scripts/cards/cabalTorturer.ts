// `Cabal Torturer` - an activation pumpTarget, an activation pumpTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CABAL_TORTURER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CABAL_TORTURER, "{B}, {T}: Target creature gets -1/-1 until end of turn.\nThreshold — {3}{B}{B}, {T}: Target creature gets -2/-2 until end of turn. Activate only if there are seven or more cards in your graveyard.");
const LINES = PRINTED.split('\n');

export const CABAL_TORTURER_SCRIPT: CardScript = {
  oracleId: CABAL_TORTURER.oracleId,
  name: CABAL_TORTURER.name,
  activated: [
    {
      ref: `${CABAL_TORTURER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -1, toughness: -1 }];
      },
    },
    {
      ref: `${CABAL_TORTURER.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -2, toughness: -2 }];
      },
    },
  ],
};
