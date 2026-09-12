// `Niblis of Frost` - a castInstantSorcery trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NIBLIS_OF_FROST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NIBLIS_OF_FROST, "Flying\nProwess (Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.)\nWhenever you cast an instant or sorcery spell, tap target creature an opponent controls. That creature doesn't untap during its controller's next untap step.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Tap target creature an opponent controls. That creature doesn't untap during its controller's next untap step.", NIBLIS_OF_FROST.name);
const VOCAB_T_L2 = vocabularyTargets("Tap target creature an opponent controls. That creature doesn't untap during its controller's next untap step.");

export const NIBLIS_OF_FROST_SCRIPT: CardScript = {
  oracleId: NIBLIS_OF_FROST.oracleId,
  name: NIBLIS_OF_FROST.name,
  triggers: [
    {
      abilityId: 'castInstantSorcery-2',
      text: LINES[2] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.some((t) => t === 'Instant' || t === 'Sorcery'),
      label: () => "Niblis of Frost - Tap target creature an opponent controls. That creature doesn't untap during its controller's next untap step.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
