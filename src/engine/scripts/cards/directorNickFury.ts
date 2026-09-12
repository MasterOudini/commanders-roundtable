// `Director Nick Fury` - a youAttack trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DIRECTOR_NICK_FURY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DIRECTOR_NICK_FURY, "Hero spells you cast cost {1} less to cast.\nWhenever you attack, look at the top four cards of your library. You may reveal a Hero card from among them and put that card into your hand. Put the rest on the bottom of your library in a random order.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Look at the top four cards of your library. You may reveal a Hero card from among them and put that card into your hand. Put the rest on the bottom of your library in a random order.", DIRECTOR_NICK_FURY.name);
const VOCAB_T_L1 = vocabularyTargets("Look at the top four cards of your library. You may reveal a Hero card from among them and put that card into your hand. Put the rest on the bottom of your library in a random order.");

export const DIRECTOR_NICK_FURY_SCRIPT: CardScript = {
  oracleId: DIRECTOR_NICK_FURY.oracleId,
  name: DIRECTOR_NICK_FURY.name,
  triggers: [
    {
      abilityId: 'youAttack-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => ctx.state.cards[a.card]?.controller === ctx.query.controllerOf(self)),
      label: () => "Director Nick Fury - Look at the top four cards of your library. You may reveal a Hero card from among them and put that card into your hand. Put the rest on the bottom of your library in a random order.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
