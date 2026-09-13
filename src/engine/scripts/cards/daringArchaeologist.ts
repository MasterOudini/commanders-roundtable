// `Daring Archaeologist` - a etb trigger vocab, a castSpell trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DARING_ARCHAEOLOGIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DARING_ARCHAEOLOGIST, "When this creature enters, you may return target artifact card from your graveyard to your hand.\nWhenever you cast a historic spell, put a +1/+1 counter on this creature. (Artifacts, legendaries, and Sagas are historic.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Return target artifact card from your graveyard to your hand.", DARING_ARCHAEOLOGIST.name);
const VOCAB_T_L0 = vocabularyTargets("Return target artifact card from your graveyard to your hand.");

export const DARING_ARCHAEOLOGIST_SCRIPT: CardScript = {
  oracleId: DARING_ARCHAEOLOGIST.oracleId,
  name: DARING_ARCHAEOLOGIST.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Daring Archaeologist - Return target artifact card from your graveyard to your hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'castSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller === ctx.query.controllerOf(self) &&
        (ctx.derive(ev.obj.card).typeLine.types.includes('Artifact') || ctx.derive(ev.obj.card).typeLine.supertypes.includes('Legendary') || ctx.derive(ev.obj.card).typeLine.subtypes.includes('Saga')),
      label: () => "Daring Archaeologist - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
