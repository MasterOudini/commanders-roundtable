// `Stronghold Biologist` — two blue, the tap and a discarded card of my
// choice (D286) counter a target creature spell.

import { STRONGHOLD_BIOLOGIST } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(STRONGHOLD_BIOLOGIST, '{U}{U}, {T}, Discard a card: Counter target creature spell.');

export const STRONGHOLD_BIOLOGIST_SCRIPT: CardScript = {
  oracleId: STRONGHOLD_BIOLOGIST.oracleId,
  name: STRONGHOLD_BIOLOGIST.name,
  activated: [
    {
      ref: `${STRONGHOLD_BIOLOGIST.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'stack') return [];
        const spell = ctx.state.stack.find((o) => o.id === target.id);
        if (!spell || spell.kind !== 'spell') return [];
        const events: EventBody[] = [{ t: 'SpellCountered', stackId: spell.id }];
        if (spell.card) {
          const vc = ctx.state.cards[spell.card];
          if (vc) events.push(moveFromStack(spell.card, 'graveyard', vc.owner));
        }
        return events;
      },
    },
  ],
};
