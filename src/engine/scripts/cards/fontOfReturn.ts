// `Font of Return` - returnToHand on "Return up to three target creature cards from your graveyard to your hand", once per pick: the count and the
// noun are the parser's and the validator's (D299). Generated from one table row.

import { FONT_OF_RETURN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FONT_OF_RETURN, "{3}{B}, Sacrifice this enchantment: Return up to three target creature cards from your graveyard to your hand.");
const TEXT = PRINTED;

export const FONT_OF_RETURN_SCRIPT: CardScript = {
  oracleId: FONT_OF_RETURN.oracleId,
  name: FONT_OF_RETURN.name,
  activated: [
    {
      ref: `${FONT_OF_RETURN.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D299: once per pick - the count is the parser's and the validator's.
        const out: EventBody[] = [];
        for (const target of obj.targets) {
          if (target.kind !== 'card') continue;
          const card = ctx.state.cards[target.id];
          if (!card || card.zone.kind !== 'graveyard') continue;
          out.push({ t: 'CardsMoved', moves: [{ card: target.id, from: { kind: 'graveyard', player: card.owner }, to: { kind: 'hand', player: card.owner } }] });
        }
        return out;
      },
    },
  ],
};
