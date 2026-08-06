// `Ertai, the Corrupted` — "{U}, {T}, Sacrifice a creature or enchantment:
// Counter target spell." D168's OR-predicate chooser paying for D170's
// counterspell — the two shapes compose with no new engine work, which is
// the staged chain's whole point. M6.4r, D174.

import { ERTAI_THE_CORRUPTED } from '../../../data/fixtures/engineCards';
import { moveFromStack } from '../../effects';
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

const TEXT = printed(
  ERTAI_THE_CORRUPTED,
  '{U}, {T}, Sacrifice a creature or enchantment: Counter target spell.',
);

export const ERTAI_THE_CORRUPTED_SCRIPT: CardScript = {
  oracleId: ERTAI_THE_CORRUPTED.oracleId,
  name: ERTAI_THE_CORRUPTED.name,
  activated: [
    {
      ref: `${ERTAI_THE_CORRUPTED.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'stack') return [];
        const spell = ctx.state.stack.find((o) => o.id === target.id);
        if (!spell || spell.kind !== 'spell') return [];
        // The vocabulary's pair (D170): the stack OBJECT dies with
        // `SpellCountered`, the CARD leaves through `moveFromStack`.
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
