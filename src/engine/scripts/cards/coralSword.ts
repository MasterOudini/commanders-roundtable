// `Coral Sword` - a etb trigger vocab, a static attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CORAL_SWORD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CORAL_SWORD, "Flash\nWhen this Equipment enters, attach it to target creature you control. That creature gains first strike until end of turn.\nEquipped creature gets +1/+0.\nEquip {1}");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Attach ~ to target creature you control. That creature gains first strike until end of turn.", CORAL_SWORD.name);
const VOCAB_T_L1 = vocabularyTargets("Attach ~ to target creature you control. That creature gains first strike until end of turn.");

export const CORAL_SWORD_SCRIPT: CardScript = {
  oracleId: CORAL_SWORD.oracleId,
  name: CORAL_SWORD.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Coral Sword - Attach ~ to target creature you control. That creature gains first strike until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-pt-2',
      text: LINES[2] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 0;
      },
    },
  ],
};
