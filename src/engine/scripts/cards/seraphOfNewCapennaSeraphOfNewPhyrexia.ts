// `Seraph of New Capenna // Seraph of New Phyrexia` - an activation vocab, a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SERAPH_OF_NEW_CAPENNA_SERAPH_OF_NEW_PHYREXIA } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
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

const PRINTED = printed(SERAPH_OF_NEW_CAPENNA_SERAPH_OF_NEW_PHYREXIA, "Flying\n{4}{B/P}: Transform this creature. Activate only as a sorcery. ({B/P} can be paid with either {B} or 2 life.)\nFlying\nWhenever this creature attacks, you may sacrifice another creature or artifact. If you do, this creature gets +2/+1 until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = transformFrom(vocabularyEffects("Transform this creature.", SERAPH_OF_NEW_CAPENNA_SERAPH_OF_NEW_PHYREXIA.name), 0);
const VOCAB_T_A0 = vocabularyTargets("Transform this creature.");
const VOCAB_L3 = vocabularyEffects("You may sacrifice another creature or artifact. If you do, this creature gets +2/+1 until end of turn.", SERAPH_OF_NEW_CAPENNA_SERAPH_OF_NEW_PHYREXIA.name);
const VOCAB_T_L3 = vocabularyTargets("You may sacrifice another creature or artifact. If you do, this creature gets +2/+1 until end of turn.");

export const SERAPH_OF_NEW_CAPENNA_SERAPH_OF_NEW_PHYREXIA_SCRIPT: CardScript = {
  oracleId: SERAPH_OF_NEW_CAPENNA_SERAPH_OF_NEW_PHYREXIA.oracleId,
  name: SERAPH_OF_NEW_CAPENNA_SERAPH_OF_NEW_PHYREXIA.name,
  activated: [
    {
      ref: `${SERAPH_OF_NEW_CAPENNA_SERAPH_OF_NEW_PHYREXIA.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'attacks-3', face: 1,
      text: LINES[3] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Seraph of New Capenna // Seraph of New Phyrexia - You may sacrifice another creature or artifact. If you do, this creature gets +2/+1 until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L3, VOCAB_T_L3);
      },
    },
  ],
};
