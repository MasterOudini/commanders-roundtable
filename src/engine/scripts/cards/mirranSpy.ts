// `Mirran Spy` - a castArtifactSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MIRRAN_SPY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MIRRAN_SPY, "Flying\nWhenever you cast an artifact spell, you may untap target creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Untap target creature.", MIRRAN_SPY.name);
const VOCAB_T_L1 = vocabularyTargets("Untap target creature.");

export const MIRRAN_SPY_SCRIPT: CardScript = {
  oracleId: MIRRAN_SPY.oracleId,
  name: MIRRAN_SPY.name,
  triggers: [
    {
      abilityId: 'castArtifactSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: true,
      targets: VOCAB_T_L1,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.includes('Artifact'),
      label: () => "Mirran Spy - Untap target creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
