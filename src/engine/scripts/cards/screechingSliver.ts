// `Screeching Sliver` - a static anthem, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SCREECHING_SLIVER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SCREECHING_SLIVER, "All Slivers have \"{T}: Target player mills a card.\"");

const VOCAB_G0 = vocabularyEffects("Target player mills a card.", SCREECHING_SLIVER.name);
const VOCAB_T_G0 = vocabularyTargets("Target player mills a card.");

const GRANT_0 = grantedActivated("{T}: Target player mills a card.", `${SCREECHING_SLIVER.oracleId}#g0`, SCREECHING_SLIVER.name);

export const SCREECHING_SLIVER_SCRIPT: CardScript = {
  oracleId: SCREECHING_SLIVER.oracleId,
  name: SCREECHING_SLIVER.name,
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
      appliesTo: (ctx, _self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Sliver"),
      modify: (chars, _ctx, self) => {
        chars.grantedActivated.push({ provider: self, ref: GRANT_0.ref, ability: GRANT_0.ability });
      },
    },
  ],
};
