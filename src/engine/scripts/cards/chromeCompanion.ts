// `Chrome Companion` - a becomesTapped trigger gainLife, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CHROME_COMPANION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CHROME_COMPANION, "Whenever this creature becomes tapped, you gain 1 life.\n{2}, {T}: Put target card from a graveyard on the bottom of its owner's library.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Put target card from a graveyard on the bottom of its owner's library.", CHROME_COMPANION.name);
const VOCAB_T_A0 = vocabularyTargets("Put target card from a graveyard on the bottom of its owner's library.");

export const CHROME_COMPANION_SCRIPT: CardScript = {
  oracleId: CHROME_COMPANION.oracleId,
  name: CHROME_COMPANION.name,
  activated: [
    {
      ref: `${CHROME_COMPANION.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'becomesTapped-0',
      text: LINES[0] as string,
      event: 'PermanentsTapped',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'PermanentsTapped' && ev.cards.includes(self),
      label: () => "Chrome Companion - gain life",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: me.life + 1 }];
      },
    },
  ],
};
