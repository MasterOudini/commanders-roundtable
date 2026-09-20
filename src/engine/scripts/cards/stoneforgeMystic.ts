// `Stoneforge Mystic` - a etb trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STONEFORGE_MYSTIC } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STONEFORGE_MYSTIC, "When this creature enters, you may search your library for an Equipment card, reveal it, put it into your hand, then shuffle.\n{1}{W}, {T}: You may put an Equipment card from your hand onto the battlefield.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Search your library for an Equipment card, reveal it, put it into your hand, then shuffle.", STONEFORGE_MYSTIC.name);
const VOCAB_T_L0 = vocabularyTargets("Search your library for an Equipment card, reveal it, put it into your hand, then shuffle.");
const VOCAB_A0 = vocabularyEffects("You may put an Equipment card from your hand onto the battlefield.", STONEFORGE_MYSTIC.name);
const VOCAB_T_A0 = vocabularyTargets("You may put an Equipment card from your hand onto the battlefield.");

export const STONEFORGE_MYSTIC_SCRIPT: CardScript = {
  oracleId: STONEFORGE_MYSTIC.oracleId,
  name: STONEFORGE_MYSTIC.name,
  activated: [
    {
      ref: `${STONEFORGE_MYSTIC.oracleId}#a0`,
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
      optional: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Stoneforge Mystic - Search your library for an Equipment card, reveal it, put it into your hand, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
