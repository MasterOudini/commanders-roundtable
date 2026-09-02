// `Arenson's Aura` — "{W}, Sacrifice an enchantment: Destroy target
// enchantment.\n{3}{U}{U}: Counter target enchantment spell." Aura
// Fracture's chooser-cost destroy (D169) with an ENCHANTMENT as the price —
// the Aura itself qualifies — and Daring Apprentice's activated counter
// (D170) narrowed to an ENCHANTMENT SPELL: the aim layer refuses a creature
// spell, and the resolve re-checks that the object is a spell at all. D272.

import { ARENSON_S_AURA } from '../../../data/fixtures/engineCards';
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
  ARENSON_S_AURA,
  '{W}, Sacrifice an enchantment: Destroy target enchantment.\n{3}{U}{U}: Counter target enchantment spell.',
);
const DESTROY = PRINTED.split('\n')[0] as string;
const COUNTER = PRINTED.split('\n')[1] as string;

export const ARENSONS_AURA_SCRIPT: CardScript = {
  oracleId: ARENSON_S_AURA.oracleId,
  name: ARENSON_S_AURA.name,
  activated: [
    {
      ref: `${ARENSON_S_AURA.oracleId}#a0`,
      text: DESTROY,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        if (ctx.derive(target.id).keywords.has('indestructible')) return [];
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
      ref: `${ARENSON_S_AURA.oracleId}#a1`,
      text: COUNTER,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'stack') return [];
        const spell = ctx.state.stack.find((o) => o.id === target.id);
        if (!spell || spell.kind !== 'spell') return [];
        // The vocabulary's own pair (D170): the stack OBJECT dies with
        // `SpellCountered`, and the CARD goes to its owner's graveyard.
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
