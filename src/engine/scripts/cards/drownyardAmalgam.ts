// `Drownyard Amalgam` - a etb trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DROWNYARD_AMALGAM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DROWNYARD_AMALGAM, "When this creature enters, target player mills three cards. (They put the top three cards of their library into their graveyard.)\n{2}{U}: This creature can't be blocked this turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Target player mills three cards.", DROWNYARD_AMALGAM.name);
const VOCAB_T_L0 = vocabularyTargets("Target player mills three cards.");
const VOCAB_A0 = vocabularyEffects("~ can't be blocked this turn.", DROWNYARD_AMALGAM.name);
const VOCAB_T_A0 = vocabularyTargets("~ can't be blocked this turn.");

export const DROWNYARD_AMALGAM_SCRIPT: CardScript = {
  oracleId: DROWNYARD_AMALGAM.oracleId,
  name: DROWNYARD_AMALGAM.name,
  activated: [
    {
      ref: `${DROWNYARD_AMALGAM.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Drownyard Amalgam - Target player mills three cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
