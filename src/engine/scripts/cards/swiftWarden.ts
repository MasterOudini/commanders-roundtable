// `Swift Warden` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SWIFT_WARDEN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SWIFT_WARDEN, "Flash\nWhen this creature enters, target Merfolk you control gains hexproof until end of turn. (It can't be the target of spells or abilities your opponents control.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target Merfolk you control gains hexproof until end of turn.", SWIFT_WARDEN.name);
const VOCAB_T_L1 = vocabularyTargets("Target Merfolk you control gains hexproof until end of turn.");

export const SWIFT_WARDEN_SCRIPT: CardScript = {
  oracleId: SWIFT_WARDEN.oracleId,
  name: SWIFT_WARDEN.name,
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
      label: () => "Swift Warden - Target Merfolk you control gains hexproof until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
