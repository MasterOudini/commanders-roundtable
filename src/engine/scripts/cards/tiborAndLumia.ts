// `Tibor and Lumia` - a castSpell trigger vocab, a castSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TIBOR_AND_LUMIA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TIBOR_AND_LUMIA, "Whenever you cast a blue spell, target creature gains flying until end of turn.\nWhenever you cast a red spell, Tibor and Lumia deals 1 damage to each creature without flying.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Target creature gains flying until end of turn.", TIBOR_AND_LUMIA.name);
const VOCAB_T_L0 = vocabularyTargets("Target creature gains flying until end of turn.");
const VOCAB_L1 = vocabularyEffects("~ deals 1 damage to each creature without flying.", TIBOR_AND_LUMIA.name);
const VOCAB_T_L1 = vocabularyTargets("~ deals 1 damage to each creature without flying.");

export const TIBOR_AND_LUMIA_SCRIPT: CardScript = {
  oracleId: TIBOR_AND_LUMIA.oracleId,
  name: TIBOR_AND_LUMIA.name,
  triggers: [
    {
      abilityId: 'castSpell-0',
      text: LINES[0] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller === ctx.query.controllerOf(self) &&
        ctx.derive(ev.obj.card).colors.includes('U'),
      label: () => "Tibor and Lumia - Target creature gains flying until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'castSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller === ctx.query.controllerOf(self) &&
        ctx.derive(ev.obj.card).colors.includes('R'),
      label: () => "Tibor and Lumia - ~ deals 1 damage to each creature without flying.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
