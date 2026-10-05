// `Jareth, Leonine Titan` - a blocks trigger pumping itself, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { JARETH_LEONINE_TITAN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(JARETH_LEONINE_TITAN, "Whenever Jareth blocks, it gets +7/+7 until end of turn.\n{W}: Jareth gains protection from the color of your choice until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ gains protection from the color of your choice until end of turn.", JARETH_LEONINE_TITAN.name);
const VOCAB_T_A0 = vocabularyTargets("~ gains protection from the color of your choice until end of turn.");

export const JARETH_LEONINE_TITAN_SCRIPT: CardScript = {
  oracleId: JARETH_LEONINE_TITAN.oracleId,
  name: JARETH_LEONINE_TITAN.name,
  activated: [
    {
      ref: `${JARETH_LEONINE_TITAN.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'blocks-0',
      text: LINES[0] as string,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.blocker === self),
      label: () => "Jareth, Leonine Titan - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 7, toughness: 7 }];
      },
    },
  ],
};
