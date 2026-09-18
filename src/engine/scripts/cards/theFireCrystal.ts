// `The Fire Crystal` - a static anthem, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THE_FIRE_CRYSTAL } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
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

const PRINTED = printed(THE_FIRE_CRYSTAL, "Red spells you cast cost {1} less to cast.\nCreatures you control have haste.\n{4}{R}{R}, {T}: Create a token that's a copy of target creature you control. Sacrifice it at the beginning of the next end step.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Create a token that's a copy of target creature you control. Sacrifice it at the beginning of the next end step.", THE_FIRE_CRYSTAL.name);
const VOCAB_T_A0 = vocabularyTargets("Create a token that's a copy of target creature you control. Sacrifice it at the beginning of the next end step.");

export const THE_FIRE_CRYSTAL_SCRIPT: CardScript = {
  oracleId: THE_FIRE_CRYSTAL.oracleId,
  name: THE_FIRE_CRYSTAL.name,
  activated: [
    {
      ref: `${THE_FIRE_CRYSTAL.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  statics: [
    {
      abilityId: 'anthem-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("haste");
      },
    },
  ],
};
