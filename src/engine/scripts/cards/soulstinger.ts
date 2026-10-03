// `Soulstinger` - a etb trigger vocab, a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SOULSTINGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SOULSTINGER, "When this creature enters, put two -1/-1 counters on target creature you control.\nWhen this creature dies, you may put a -1/-1 counter on target creature for each -1/-1 counter on this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Put two -1/-1 counters on target creature you control.", SOULSTINGER.name);
const VOCAB_T_L0 = vocabularyTargets("Put two -1/-1 counters on target creature you control.");
const VOCAB_L1 = vocabularyEffects("Put a -1/-1 counter on target creature for each -1/-1 counter on ~.", SOULSTINGER.name);
const VOCAB_T_L1 = vocabularyTargets("Put a -1/-1 counter on target creature for each -1/-1 counter on ~.");

export const SOULSTINGER_SCRIPT: CardScript = {
  oracleId: SOULSTINGER.oracleId,
  name: SOULSTINGER.name,
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
      label: () => "Soulstinger - Put two -1/-1 counters on target creature you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'dies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      targets: VOCAB_T_L1,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Soulstinger - Put a -1/-1 counter on target creature for each -1/-1 counter on ~.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
