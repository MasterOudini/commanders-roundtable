// `Ensouled Scimitar` - an activation vocab, a static attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ENSOULED_SCIMITAR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ENSOULED_SCIMITAR, "{3}: This artifact becomes a 1/5 Spirit artifact creature with flying until end of turn. (Equipment that's a creature can't equip a creature.)\nEquipped creature gets +1/+5.\nEquip {2} ({2}: Attach to target creature you control. Equip only as a sorcery.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ becomes a 1/5 Spirit artifact creature with flying until end of turn.", ENSOULED_SCIMITAR.name);
const VOCAB_T_A0 = vocabularyTargets("~ becomes a 1/5 Spirit artifact creature with flying until end of turn.");

export const ENSOULED_SCIMITAR_SCRIPT: CardScript = {
  oracleId: ENSOULED_SCIMITAR.oracleId,
  name: ENSOULED_SCIMITAR.name,
  activated: [
    {
      ref: `${ENSOULED_SCIMITAR.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 5;
      },
    },
  ],
};
