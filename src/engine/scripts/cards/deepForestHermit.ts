// `Deep Forest Hermit` - a etb trigger vocab, a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DEEP_FOREST_HERMIT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DEEP_FOREST_HERMIT, "Vanishing 3 (This creature enters with three time counters on it. At the beginning of your upkeep, remove a time counter from it. When the last is removed, sacrifice it.)\nWhen this creature enters, create four 1/1 green Squirrel creature tokens.\nSquirrels you control get +1/+1.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Create four 1/1 green Squirrel creature tokens.", DEEP_FOREST_HERMIT.name);
const VOCAB_T_L1 = vocabularyTargets("Create four 1/1 green Squirrel creature tokens.");

export const DEEP_FOREST_HERMIT_SCRIPT: CardScript = {
  oracleId: DEEP_FOREST_HERMIT.oracleId,
  name: DEEP_FOREST_HERMIT.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Deep Forest Hermit - Create four 1/1 green Squirrel creature tokens.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
  statics: [
    {
      abilityId: 'anthem-pt-2',
      text: LINES[2] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Squirrel") && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
  ],
};
