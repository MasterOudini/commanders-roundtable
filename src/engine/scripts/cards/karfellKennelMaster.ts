// `Karfell Kennel-Master` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KARFELL_KENNEL_MASTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KARFELL_KENNEL_MASTER, "When this creature enters, up to two target creatures each get +1/+0 and gain indestructible until end of turn. (Damage and effects that say \"destroy\" don't destroy them.)");

const VOCAB_L0 = vocabularyEffects("Up to two target creatures each get +1/+0 and gain indestructible until end of turn.", KARFELL_KENNEL_MASTER.name);
const VOCAB_T_L0 = vocabularyTargets("Up to two target creatures each get +1/+0 and gain indestructible until end of turn.");

export const KARFELL_KENNEL_MASTER_SCRIPT: CardScript = {
  oracleId: KARFELL_KENNEL_MASTER.oracleId,
  name: KARFELL_KENNEL_MASTER.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Karfell Kennel-Master - Up to two target creatures each get +1/+0 and gain indestructible until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
