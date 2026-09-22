// `Firewake Sliver` - a static anthem, a static anthem, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FIREWAKE_SLIVER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FIREWAKE_SLIVER, "All Sliver creatures have haste.\nAll Slivers have \"{1}, Sacrifice this permanent: Target Sliver creature gets +2/+2 until end of turn.\"");
const LINES = PRINTED.split('\n');

const VOCAB_G1 = vocabularyEffects("Target Sliver creature gets +2/+2 until end of turn.", FIREWAKE_SLIVER.name);
const VOCAB_T_G1 = vocabularyTargets("Target Sliver creature gets +2/+2 until end of turn.");

const GRANT_1 = grantedActivated("{1}, Sacrifice this permanent: Target Sliver creature gets +2/+2 until end of turn.", `${FIREWAKE_SLIVER.oracleId}#g1`, FIREWAKE_SLIVER.name);

export const FIREWAKE_SLIVER_SCRIPT: CardScript = {
  oracleId: FIREWAKE_SLIVER.oracleId,
  name: FIREWAKE_SLIVER.name,
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
      abilityId: 'anthem-grant-0',
      text: LINES[0] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, _self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Sliver"),
      modify: (chars) => {
        chars.keywords.add("haste");
      },
    },
    {
      abilityId: 'anthem-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, _self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Sliver"),
      modify: (chars, _ctx, self) => {
        chars.grantedActivated.push({ provider: self, ref: GRANT_1.ref, ability: GRANT_1.ability });
      },
    },
  ],
};
