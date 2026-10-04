// `Mister Gutsy` - a castSpell trigger selfCounter, a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MISTER_GUTSY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MISTER_GUTSY, "Whenever you cast an Aura or Equipment spell, put a +1/+1 counter on this creature.\nWhen this creature dies, create X Junk tokens, where X is the number of +1/+1 counters on it. (They're artifacts with \"{T}, Sacrifice this token: Exile the top card of your library. You may play that card this turn. Activate only as a sorcery.\")");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Create X Junk tokens, where X is the number of +1/+1 counters on ~.", MISTER_GUTSY.name);
const VOCAB_T_L1 = vocabularyTargets("Create X Junk tokens, where X is the number of +1/+1 counters on ~.");

export const MISTER_GUTSY_SCRIPT: CardScript = {
  oracleId: MISTER_GUTSY.oracleId,
  name: MISTER_GUTSY.name,
  triggers: [
    {
      abilityId: 'castSpell-0',
      text: LINES[0] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller === ctx.query.controllerOf(self) &&
        (ctx.derive(ev.obj.card).typeLine.subtypes.includes('Aura') || ctx.derive(ev.obj.card).typeLine.subtypes.includes('Equipment')),
      label: () => "Mister Gutsy - a counter on it",
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
      label: () => "Mister Gutsy - Create X Junk tokens, where X is the number of +1/+1 counters on ~.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
