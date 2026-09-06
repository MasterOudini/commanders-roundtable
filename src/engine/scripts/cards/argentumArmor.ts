// `Argentum Armor` - a static attachedStatic, a equippedCreatureAttacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ARGENTUM_ARMOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ARGENTUM_ARMOR, "Equipped creature gets +6/+6.\nWhenever equipped creature attacks, destroy target permanent.\nEquip {6}");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Destroy target permanent.", ARGENTUM_ARMOR.name);
const VOCAB_T_L1 = vocabularyTargets("Destroy target permanent.");

export const ARGENTUM_ARMOR_SCRIPT: CardScript = {
  oracleId: ARGENTUM_ARMOR.oracleId,
  name: ARGENTUM_ARMOR.name,
  triggers: [
    {
      abilityId: 'equippedCreatureAttacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === ctx.state.cards[self]?.attachedTo),
      label: () => "Argentum Armor - Destroy target permanent.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-pt-0',
      text: LINES[0] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 6;
        if (chars.toughness !== null) chars.toughness += 6;
      },
    },
  ],
};
