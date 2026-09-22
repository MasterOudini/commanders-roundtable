// `Poultice Sliver` - a static anthem, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { POULTICE_SLIVER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(POULTICE_SLIVER, "All Slivers have \"{2}, {T}: Regenerate target Sliver.\" (The next time that Sliver would be destroyed this turn, instead tap it, remove it from combat, and heal all damage on it.)");

const VOCAB_G0 = vocabularyEffects("Regenerate target Sliver.", POULTICE_SLIVER.name);
const VOCAB_T_G0 = vocabularyTargets("Regenerate target Sliver.");

const GRANT_0 = grantedActivated("{2}, {T}: Regenerate target Sliver.", `${POULTICE_SLIVER.oracleId}#g0`, POULTICE_SLIVER.name);

export const POULTICE_SLIVER_SCRIPT: CardScript = {
  oracleId: POULTICE_SLIVER.oracleId,
  name: POULTICE_SLIVER.name,
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
