// `Order of the Sacred Torch` - counter on "Counter target black spell": the adjective is the parser's and the
// validator's (D294). Generated from one table row (D295).

import { ORDER_OF_THE_SACRED_TORCH } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import { moveFromStack } from '../../effects';
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

const PRINTED = printed(ORDER_OF_THE_SACRED_TORCH, "{T}, Pay 1 life: Counter target black spell.");
const TEXT = PRINTED;

export const ORDER_OF_THE_SACRED_TORCH_SCRIPT: CardScript = {
  oracleId: ORDER_OF_THE_SACRED_TORCH.oracleId,
  name: ORDER_OF_THE_SACRED_TORCH.name,
  activated: [
    {
      ref: `${ORDER_OF_THE_SACRED_TORCH.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'stack') return [];
        const spell = ctx.state.stack.find((o) => o.id === target.id);
        if (!spell || spell.kind !== 'spell') return [];
        // Two events, the vocabulary's own pair: the stack object dies and the card
        // goes to its owner's graveyard (daringApprentice's lesson).
        const out: EventBody[] = [{ t: 'SpellCountered', stackId: spell.id }];
        if (spell.card) {
          const vc = ctx.state.cards[spell.card];
          if (vc) out.push(moveFromStack(spell.card, 'graveyard', vc.owner));
        }
        return out;
      },
    },
  ],
};
