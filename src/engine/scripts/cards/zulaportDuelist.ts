// `Zulaport Duelist` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ZULAPORT_DUELIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ZULAPORT_DUELIST, "Flash\nWhen this creature enters, up to one target creature gets -2/-0 until end of turn. Its controller mills two cards. (They put the top two cards of their library into their graveyard.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Up to one target creature gets -2/-0 until end of turn. Its controller mills two cards.", ZULAPORT_DUELIST.name);
const VOCAB_T_L1 = vocabularyTargets("Up to one target creature gets -2/-0 until end of turn. Its controller mills two cards.");

export const ZULAPORT_DUELIST_SCRIPT: CardScript = {
  oracleId: ZULAPORT_DUELIST.oracleId,
  name: ZULAPORT_DUELIST.name,
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
      label: () => "Zulaport Duelist - Up to one target creature gets -2/-0 until end of turn. Its controller mills two cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
