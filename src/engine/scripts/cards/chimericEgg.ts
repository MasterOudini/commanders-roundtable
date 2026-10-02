// `Chimeric Egg` - a opponentCastsSpell trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CHIMERIC_EGG } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CHIMERIC_EGG, "Whenever an opponent casts a nonartifact spell, put a charge counter on this artifact.\nRemove three charge counters from this artifact: This artifact becomes a 6/6 Construct artifact creature with trample until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Put a charge counter on this artifact.", CHIMERIC_EGG.name);
const VOCAB_T_L0 = vocabularyTargets("Put a charge counter on this artifact.");
const VOCAB_A0 = vocabularyEffects("~ becomes a 6/6 Construct artifact creature with trample until end of turn.", CHIMERIC_EGG.name);
const VOCAB_T_A0 = vocabularyTargets("~ becomes a 6/6 Construct artifact creature with trample until end of turn.");

export const CHIMERIC_EGG_SCRIPT: CardScript = {
  oracleId: CHIMERIC_EGG.oracleId,
  name: CHIMERIC_EGG.name,
  activated: [
    {
      ref: `${CHIMERIC_EGG.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'opponentCastsSpell-0',
      text: LINES[0] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller !== ctx.query.controllerOf(self) &&
        !ctx.derive(ev.obj.card).typeLine.types.includes('Artifact'),
      label: () => "Chimeric Egg - Put a charge counter on this artifact.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
