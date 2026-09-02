// `Teferi's Care` — an enchantment of mine sold to destroy an enchantment;
// five mana to counter an enchantment spell.

import { TEFERI_S_CARE } from '../../../data/fixtures/engineCards';
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
  TEFERI_S_CARE,
  '{W}, Sacrifice an enchantment: Destroy target enchantment.\n{3}{U}{U}: Counter target enchantment spell.',
);
const DESTROY = PRINTED.split('\n')[0] as string;
const COUNTER = PRINTED.split('\n')[1] as string;

export const TEFERIS_CARE_SCRIPT: CardScript = {
  oracleId: TEFERI_S_CARE.oracleId,
  name: TEFERI_S_CARE.name,
  activated: [
    {
      ref: `${TEFERI_S_CARE.oracleId}#a0`,
      text: DESTROY,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [
          {
            t: 'CardsMoved',
            moves: [
              {
                card: target.id,
                from: { kind: 'battlefield', player: card.controller },
                to: { kind: 'graveyard', player: card.owner },
              },
            ],
          },
        ];
      },
    },
    {
      ref: `${TEFERI_S_CARE.oracleId}#a1`,
      text: COUNTER,
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
