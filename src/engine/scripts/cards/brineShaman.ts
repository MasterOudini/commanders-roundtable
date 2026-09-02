// `Brine Shaman` — "{T}, Sacrifice a creature: Target creature gets +2/+2
// until end of turn.\n{1}{U}{U}, Sacrifice a creature: Counter target
// creature spell." Blighted Shaman's creature-price pump (D272) and Arenson's
// Aura's typed activated counter (D272) narrowed to a CREATURE spell, on one
// Cleric. Both prices are charged at activation (D159) — the second can eat
// the Shaman itself — so neither resolve reads `self`. D273.

import { BRINE_SHAMAN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  BRINE_SHAMAN,
  '{T}, Sacrifice a creature: Target creature gets +2/+2 until end of turn.\n{1}{U}{U}, Sacrifice a creature: Counter target creature spell.',
);
const PUMP = PRINTED.split('\n')[0] as string;
const COUNTER = PRINTED.split('\n')[1] as string;

export const BRINE_SHAMAN_SCRIPT: CardScript = {
  oracleId: BRINE_SHAMAN.oracleId,
  name: BRINE_SHAMAN.name,
  activated: [
    {
      ref: `${BRINE_SHAMAN.oracleId}#a0`,
      text: PUMP,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 2, keywords: [] }];
      },
    },
    {
      ref: `${BRINE_SHAMAN.oracleId}#a1`,
      text: COUNTER,
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
