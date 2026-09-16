// `Mystic Might` - a static attachedStatic, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MYSTIC_MIGHT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MYSTIC_MIGHT, "Enchant land you control\nCumulative upkeep {1}{U} (At the beginning of your upkeep, put an age counter on this permanent, then sacrifice it unless you pay its upkeep cost for each age counter on it.)\nEnchanted land has \"{T}: Target creature gets +2/+2 until end of turn.\"");
const LINES = PRINTED.split('\n');

const VOCAB_G2 = vocabularyEffects("Target creature gets +2/+2 until end of turn.", MYSTIC_MIGHT.name);
const VOCAB_T_G2 = vocabularyTargets("Target creature gets +2/+2 until end of turn.");

const GRANT_2 = grantedActivated("{T}: Target creature gets +2/+2 until end of turn.", `${MYSTIC_MIGHT.oracleId}#g2`, MYSTIC_MIGHT.name);

export const MYSTIC_MIGHT_SCRIPT: CardScript = {
  oracleId: MYSTIC_MIGHT.oracleId,
  name: MYSTIC_MIGHT.name,
  activated: [
    {
      ref: GRANT_2.ref,
      text: LINES[2] as string,
      granted: GRANT_2.ability,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_G2, VOCAB_T_G2);
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-grant-2',
      text: LINES[2] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars, _ctx, self) => {
        chars.grantedActivated.push({ provider: self, ref: GRANT_2.ref, ability: GRANT_2.ability });
      },
    },
  ],
};
