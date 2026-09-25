// `Erinis, Gloom Stalker` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ERINIS_GLOOM_STALKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ERINIS_GLOOM_STALKER, "Deathtouch\nWhenever Erinis attacks, return target land card from your graveyard to the battlefield.\nChoose a Background (You can have a Background as a second commander.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Return target land card from your graveyard to the battlefield.", ERINIS_GLOOM_STALKER.name);
const VOCAB_T_L1 = vocabularyTargets("Return target land card from your graveyard to the battlefield.");

export const ERINIS_GLOOM_STALKER_SCRIPT: CardScript = {
  oracleId: ERINIS_GLOOM_STALKER.oracleId,
  name: ERINIS_GLOOM_STALKER.name,
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Erinis, Gloom Stalker - Return target land card from your graveyard to the battlefield.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
