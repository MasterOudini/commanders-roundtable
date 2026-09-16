// `Sunken Field` - a static attachedStatic, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SUNKEN_FIELD } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { grantedActivated } from '../grants';
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

const PRINTED = printed(SUNKEN_FIELD, "Enchant land\nEnchanted land has \"{T}: Counter target spell unless its controller pays {1}.\"");
const LINES = PRINTED.split('\n');

const VOCAB_G1 = vocabularyEffects("Counter target spell unless its controller pays {1}.", SUNKEN_FIELD.name);
const VOCAB_T_G1 = vocabularyTargets("Counter target spell unless its controller pays {1}.");

const GRANT_1 = grantedActivated("{T}: Counter target spell unless its controller pays {1}.", `${SUNKEN_FIELD.oracleId}#g1`, SUNKEN_FIELD.name);

export const SUNKEN_FIELD_SCRIPT: CardScript = {
  oracleId: SUNKEN_FIELD.oracleId,
  name: SUNKEN_FIELD.name,
  activated: [
    {
      ref: GRANT_1.ref,
      text: LINES[1] as string,
      granted: GRANT_1.ability,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_G1, VOCAB_T_G1);
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars, _ctx, self) => {
        chars.grantedActivated.push({ provider: self, ref: GRANT_1.ref, ability: GRANT_1.ability });
      },
    },
  ],
};
