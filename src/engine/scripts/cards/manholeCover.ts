// `Manhole Cover` - a etb trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MANHOLE_COVER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MANHOLE_COVER, "Flash (You may cast this spell any time you could cast an instant.)\nWhen this artifact enters, target creature gains indestructible until end of turn. (Damage and effects that say \"destroy\" don't destroy it.)\n{2}, Sacrifice this artifact: Target player draws a card.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Target creature gains indestructible until end of turn.", MANHOLE_COVER.name);
const VOCAB_T_L1 = vocabularyTargets("Target creature gains indestructible until end of turn.");
const VOCAB_A0 = vocabularyEffects("Target player draws a card.", MANHOLE_COVER.name);
const VOCAB_T_A0 = vocabularyTargets("Target player draws a card.");

export const MANHOLE_COVER_SCRIPT: CardScript = {
  oracleId: MANHOLE_COVER.oracleId,
  name: MANHOLE_COVER.name,
  activated: [
    {
      ref: `${MANHOLE_COVER.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
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
      label: () => "Manhole Cover - Target creature gains indestructible until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
