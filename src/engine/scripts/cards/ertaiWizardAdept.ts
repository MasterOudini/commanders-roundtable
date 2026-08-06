// `Ertai, Wizard Adept` — "{2}{U}{U}, {T}: Counter target spell." Daring
// Apprentice's counter with a mana rider and the Wizard still standing.
// M6.4r, D174.

import { ERTAI_WIZARD_ADEPT } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(ERTAI_WIZARD_ADEPT, '{2}{U}{U}, {T}: Counter target spell.');

export const ERTAI_WIZARD_ADEPT_SCRIPT: CardScript = {
  oracleId: ERTAI_WIZARD_ADEPT.oracleId,
  name: ERTAI_WIZARD_ADEPT.name,
  activated: [
    {
      ref: `${ERTAI_WIZARD_ADEPT.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'stack') return [];
        const spell = ctx.state.stack.find((o) => o.id === target.id);
        if (!spell || spell.kind !== 'spell') return [];
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
