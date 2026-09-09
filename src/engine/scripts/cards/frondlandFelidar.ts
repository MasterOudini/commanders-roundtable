// `Frondland Felidar` - every permanent in its scope HAS a quoted
// activated ability (D367's carrier): a layer-6 static installs it, and the def carrying that
// grant's ref resolves the quoted body through the engine's own effect vocabulary (D344).
// ⚠️ The RECIPIENT is the ability's source (CR 113.7a) - it taps, it pays, and "this creature"
// in the quoted body is the recipient, not this card. Generated from one table row.

import { FRONDLAND_FELIDAR } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { grantedActivated } from '../grants';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';

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

const PRINTED = printed(FRONDLAND_FELIDAR, "Vigilance\nCreatures you control with vigilance have \"{1}, {T}: Tap target creature.\"");
const LINES = PRINTED.split('\n');

const GRANT = grantedActivated("{1}, {T}: Tap target creature.", `${FRONDLAND_FELIDAR.oracleId}#g1`, FRONDLAND_FELIDAR.name);
const VOCAB = vocabularyEffects("Tap target creature.", FRONDLAND_FELIDAR.name);
const VOCAB_T = vocabularyTargets("Tap target creature.");

export const FRONDLAND_FELIDAR_SCRIPT: CardScript = {
  oracleId: FRONDLAND_FELIDAR.oracleId,
  name: FRONDLAND_FELIDAR.name,
  statics: [
    {
      abilityId: 'grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && chars.keywords.has("vigilance") && ctx.query.controllerOf(candidate) === ctx.query.controllerOf(self),
      modify: (chars, _ctx, self) => {
        chars.grantedActivated.push({ provider: self, ref: GRANT.ref, ability: GRANT.ability });
      },
    },
  ],
  activated: [
    {
      ref: GRANT.ref,
      text: LINES[1] as string,
      granted: GRANT.ability,
      resolve: (ctx, _self, obj) => ctx.vocabulary(obj, VOCAB, VOCAB_T),
    },
  ],
};
