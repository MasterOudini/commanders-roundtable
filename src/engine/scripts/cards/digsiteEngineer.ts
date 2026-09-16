// `Digsite Engineer` - a castArtifactSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DIGSITE_ENGINEER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DIGSITE_ENGINEER, "Whenever you cast an artifact spell, you may pay {2}. If you do, create a 0/0 colorless Construct artifact creature token with \"This token gets +1/+1 for each artifact you control.\"");

const VOCAB_L0 = vocabularyEffects("You may pay {2}. If you do, create a 0/0 colorless Construct artifact creature token with \"This token gets +1/+1 for each artifact you control.\"", DIGSITE_ENGINEER.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {2}. If you do, create a 0/0 colorless Construct artifact creature token with \"This token gets +1/+1 for each artifact you control.\"");

export const DIGSITE_ENGINEER_SCRIPT: CardScript = {
  oracleId: DIGSITE_ENGINEER.oracleId,
  name: DIGSITE_ENGINEER.name,
  triggers: [
    {
      abilityId: 'castArtifactSpell-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.includes('Artifact'),
      label: () => "Digsite Engineer - You may pay {2}. If you do, create a 0/0 colorless Construct artifact creature token with \"This token gets +1/+1 for each artifact you control.\"",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
