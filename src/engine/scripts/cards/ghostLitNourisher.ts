// `Ghost-Lit Nourisher` - an activation pumpTarget, an activation pumpTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GHOST_LIT_NOURISHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GHOST_LIT_NOURISHER, "{2}{G}, {T}: Target creature gets +2/+2 until end of turn.\nChannel — {3}{G}, Discard this card: Target creature gets +4/+4 until end of turn.");
const LINES = PRINTED.split('\n');

export const GHOST_LIT_NOURISHER_SCRIPT: CardScript = {
  oracleId: GHOST_LIT_NOURISHER.oracleId,
  name: GHOST_LIT_NOURISHER.name,
  activated: [
    {
      ref: `${GHOST_LIT_NOURISHER.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 2 }];
      },
    },
    {
      ref: `${GHOST_LIT_NOURISHER.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 4, toughness: 4 }];
      },
    },
  ],
};
