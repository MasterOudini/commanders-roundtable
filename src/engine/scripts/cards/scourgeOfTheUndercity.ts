// `Scourge of the Undercity` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SCOURGE_OF_THE_UNDERCITY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SCOURGE_OF_THE_UNDERCITY, "Lifelink (Damage dealt by this creature also causes you to gain that much life.)\nWhen this creature enters, another target creature you control gains lifelink until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Another target creature you control gains lifelink until end of turn.", SCOURGE_OF_THE_UNDERCITY.name);
const VOCAB_T_L1 = vocabularyTargets("Another target creature you control gains lifelink until end of turn.");

export const SCOURGE_OF_THE_UNDERCITY_SCRIPT: CardScript = {
  oracleId: SCOURGE_OF_THE_UNDERCITY.oracleId,
  name: SCOURGE_OF_THE_UNDERCITY.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Scourge of the Undercity - Another target creature you control gains lifelink until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
