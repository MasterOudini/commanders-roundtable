// `Lunarch Mantle` - a static attachedStatic, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LUNARCH_MANTLE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LUNARCH_MANTLE, "Enchant creature\nEnchanted creature gets +2/+2 and has \"{1}, Sacrifice a permanent: This creature gains flying until end of turn.\"");
const LINES = PRINTED.split('\n');

const VOCAB_G1 = vocabularyEffects("~ gains flying until end of turn.", LUNARCH_MANTLE.name);
const VOCAB_T_G1 = vocabularyTargets("~ gains flying until end of turn.");

const GRANT_1 = grantedActivated("{1}, Sacrifice a permanent: This creature gains flying until end of turn.", `${LUNARCH_MANTLE.oracleId}#g1`, LUNARCH_MANTLE.name);

export const LUNARCH_MANTLE_SCRIPT: CardScript = {
  oracleId: LUNARCH_MANTLE.oracleId,
  name: LUNARCH_MANTLE.name,
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
      abilityId: 'attached-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 2;
        if (chars.toughness !== null) chars.toughness += 2;
      },
    },
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
