// `Mask of Memory` - a equippedCreatureCombatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MASK_OF_MEMORY } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(MASK_OF_MEMORY, "Whenever equipped creature deals combat damage to a player, you may draw two cards. If you do, discard a card.\nEquip {1} ({1}: Attach to target creature you control. Equip only as a sorcery.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Draw two cards. If you do, discard a card.", MASK_OF_MEMORY.name);
const VOCAB_T_L0 = vocabularyTargets("Draw two cards. If you do, discard a card.");

export const MASK_OF_MEMORY_SCRIPT: CardScript = {
  oracleId: MASK_OF_MEMORY.oracleId,
  name: MASK_OF_MEMORY.name,
  triggers: [
    {
      abilityId: 'equippedCreatureCombatDamagePlayer-0',
      text: LINES[0] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === ctx.state.cards[self]?.attachedTo && d.target.kind === 'player' && d.amount > 0),
      label: () => "Mask of Memory - Draw two cards. If you do, discard a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
