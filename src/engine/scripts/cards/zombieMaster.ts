// `Zombie Master` - a static anthem, a static anthem, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ZOMBIE_MASTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ZOMBIE_MASTER, "Other Zombie creatures have swampwalk. (They can't be blocked as long as defending player controls a Swamp.)\nOther Zombies have \"{B}: Regenerate this permanent.\"");
const LINES = PRINTED.split('\n');

const VOCAB_G1 = vocabularyEffects("Regenerate this permanent.", ZOMBIE_MASTER.name);
const VOCAB_T_G1 = vocabularyTargets("Regenerate this permanent.");

const GRANT_1 = grantedActivated("{B}: Regenerate this permanent.", `${ZOMBIE_MASTER.oracleId}#g1`, ZOMBIE_MASTER.name);

export const ZOMBIE_MASTER_SCRIPT: CardScript = {
  oracleId: ZOMBIE_MASTER.oracleId,
  name: ZOMBIE_MASTER.name,
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
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Zombie"),
      modify: (chars) => {
        chars.landwalk = [...chars.landwalk, "Swamp"];
      },
    },
    {
      abilityId: 'anthem-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Zombie"),
      modify: (chars, _ctx, self) => {
        chars.grantedActivated.push({ provider: self, ref: GRANT_1.ref, ability: GRANT_1.ability });
      },
    },
  ],
};
