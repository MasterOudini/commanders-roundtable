// `Mystic Skull // Mystic Monstrosity` - an activation vocab, a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MYSTIC_SKULL_MYSTIC_MONSTROSITY } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { grantedMana, pushGrantedMana } from '../grants';
import { transformFrom, vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(MYSTIC_SKULL_MYSTIC_MONSTROSITY, "{1}, {T}: Add one mana of any color.\n{5}, {T}: Transform this artifact.\nLands you control have \"{T}: Add one mana of any color.\"");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = transformFrom(vocabularyEffects("Transform this artifact.", MYSTIC_SKULL_MYSTIC_MONSTROSITY.name), 0);
const VOCAB_T_A1 = vocabularyTargets("Transform this artifact.");

const GRANT_2 = grantedMana("{T}: Add one mana of any color.", MYSTIC_SKULL_MYSTIC_MONSTROSITY.name);

export const MYSTIC_SKULL_MYSTIC_MONSTROSITY_SCRIPT: CardScript = {
  oracleId: MYSTIC_SKULL_MYSTIC_MONSTROSITY.oracleId,
  name: MYSTIC_SKULL_MYSTIC_MONSTROSITY.name,
  activated: [
    {
      ref: `${MYSTIC_SKULL_MYSTIC_MONSTROSITY.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
  statics: [
    {
      abilityId: 'anthem-grant-2', face: 1,
      text: LINES[2] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Land') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.types.includes('Land') && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        pushGrantedMana(chars, GRANT_2);
      },
    },
  ],
};
