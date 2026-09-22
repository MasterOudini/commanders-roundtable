// `Bootleggers' Stash` - a static anthem, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BOOTLEGGERS_STASH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BOOTLEGGERS_STASH, "Lands you control have \"{T}: Create a Treasure token.\"");

const VOCAB_G0 = vocabularyEffects("Create a Treasure token.", BOOTLEGGERS_STASH.name);
const VOCAB_T_G0 = vocabularyTargets("Create a Treasure token.");

const GRANT_0 = grantedActivated("{T}: Create a Treasure token.", `${BOOTLEGGERS_STASH.oracleId}#g0`, BOOTLEGGERS_STASH.name);

export const BOOTLEGGERS_STASH_SCRIPT: CardScript = {
  oracleId: BOOTLEGGERS_STASH.oracleId,
  name: BOOTLEGGERS_STASH.name,
  activated: [
    {
      ref: GRANT_0.ref,
      text: PRINTED,
      granted: GRANT_0.ability,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_G0, VOCAB_T_G0);
      },
    },
  ],
  statics: [
    {
      abilityId: 'anthem-grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Land') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.types.includes('Land') && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars, _ctx, self) => {
        chars.grantedActivated.push({ provider: self, ref: GRANT_0.ref, ability: GRANT_0.ability });
      },
    },
  ],
};
