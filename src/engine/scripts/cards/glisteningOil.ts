// `Glistening Oil` - a static attachedStatic, a upkeep trigger vocab, a auraToGraveyard trigger bounceSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GLISTENING_OIL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GLISTENING_OIL, "Enchant creature\nEnchanted creature has infect.\nAt the beginning of your upkeep, put a -1/-1 counter on enchanted creature.\nWhen this Aura is put into a graveyard from the battlefield, return it to its owner's hand.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Put a -1/-1 counter on enchanted creature.", GLISTENING_OIL.name);
const VOCAB_T_L2 = vocabularyTargets("Put a -1/-1 counter on enchanted creature.");

export const GLISTENING_OIL_SCRIPT: CardScript = {
  oracleId: GLISTENING_OIL.oracleId,
  name: GLISTENING_OIL.name,
  triggers: [
    {
      abilityId: 'upkeep-2',
      text: LINES[2] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Glistening Oil - Put a -1/-1 counter on enchanted creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
    {
      abilityId: 'auraToGraveyard-3',
      text: LINES[3] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Glistening Oil - bounceSelf",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'graveyard') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'graveyard', player: me.owner }, to: { kind: 'hand', player: me.owner } }] }];
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("infect");
      },
    },
  ],
};
