// `Bria, Riptide Rogue` - a static anthem, a castNoncreature trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BRIA_RIPTIDE_ROGUE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BRIA_RIPTIDE_ROGUE, "Prowess (Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.)\nOther creatures you control have prowess. (If a creature has multiple instances of prowess, each triggers separately.)\nWhenever you cast a noncreature spell, target creature you control can't be blocked this turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Target creature you control can't be blocked this turn.", BRIA_RIPTIDE_ROGUE.name);
const VOCAB_T_L2 = vocabularyTargets("Target creature you control can't be blocked this turn.");

export const BRIA_RIPTIDE_ROGUE_SCRIPT: CardScript = {
  oracleId: BRIA_RIPTIDE_ROGUE.oracleId,
  name: BRIA_RIPTIDE_ROGUE.name,
  triggers: [
    {
      abilityId: 'castNoncreature-2',
      text: LINES[2] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && !ctx.derive(ev.obj.card).typeLine.types.includes('Creature'),
      label: () => "Bria, Riptide Rogue - Target creature you control can't be blocked this turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
  statics: [
    {
      abilityId: 'anthem-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        chars.keywords.add("prowess");
      },
    },
  ],
};
