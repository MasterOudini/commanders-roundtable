// `Aven Brigadier` - two layer-6 anthems on one card, "Other Bird creatures get
// +1/+1" and "Other Soldier creatures get +1/+1" (every controller's; StaticDefs
// in the shape of the engine's Levitation, D300). Flying is the engine's. A Bird
// Soldier itself, it is "other" to neither line.

import { AVEN_BRIGADIER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';

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

const PRINTED = printed(AVEN_BRIGADIER, 'Flying\nOther Bird creatures get +1/+1.\nOther Soldier creatures get +1/+1.');
const LINES = PRINTED.split('\n');

function anthemFor(subtype: string, text: string) {
  return {
    abilityId: `anthem-${subtype.toLowerCase()}`,
    text,
    layer: 'ptModify' as const,
    activeZones: ['battlefield' as const],
    appliesTo: (ctx: Parameters<NonNullable<CardScript['statics']>[number]['appliesTo']>[0], self: string, candidate: string, chars: Parameters<NonNullable<CardScript['statics']>[number]['appliesTo']>[3]) => {
      const source = ctx.state.cards[self];
      const target = ctx.state.cards[candidate];
      if (!source || !target || target.zone.kind !== 'battlefield') return false;
      if (candidate === self) return false;
      if (!chars.typeLine.types.includes('Creature')) return false;
      return chars.typeLine.subtypes.includes(subtype);
    },
    modify: (chars: Parameters<NonNullable<CardScript['statics']>[number]['modify']>[0]) => {
      if (chars.power !== null) chars.power += 1;
      if (chars.toughness !== null) chars.toughness += 1;
    },
  };
}

export const AVEN_BRIGADIER_SCRIPT: CardScript = {
  oracleId: AVEN_BRIGADIER.oracleId,
  name: AVEN_BRIGADIER.name,
  statics: [anthemFor('Bird', LINES[1] as string), anthemFor('Soldier', LINES[2] as string)],
};
