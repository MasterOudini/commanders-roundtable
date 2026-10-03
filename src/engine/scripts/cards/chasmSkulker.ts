// `Chasm Skulker` - a drawsCard trigger selfCounter, a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CHASM_SKULKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CHASM_SKULKER, "Whenever you draw a card, put a +1/+1 counter on this creature.\nWhen this creature dies, create X 1/1 blue Squid creature tokens with islandwalk, where X is the number of +1/+1 counters on this creature. (They can't be blocked as long as defending player controls an Island.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Create X 1/1 blue Squid creature tokens with islandwalk, where X is the number of +1/+1 counters on ~.", CHASM_SKULKER.name);
const VOCAB_T_L1 = vocabularyTargets("Create X 1/1 blue Squid creature tokens with islandwalk, where X is the number of +1/+1 counters on ~.");

export const CHASM_SKULKER_SCRIPT: CardScript = {
  oracleId: CHASM_SKULKER.oracleId,
  name: CHASM_SKULKER.name,
  triggers: [
    {
      abilityId: 'drawsCard-0',
      text: LINES[0] as string,
      event: 'DrewCards',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'DrewCards' && ev.player === ctx.query.controllerOf(self),
      label: () => "Chasm Skulker - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
    {
      abilityId: 'dies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Chasm Skulker - Create X 1/1 blue Squid creature tokens with islandwalk, where X is the number of +1/+1 counters on ~.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
