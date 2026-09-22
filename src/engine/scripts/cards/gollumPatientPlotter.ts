// `Gollum, Patient Plotter` - a leavesBattlefield trigger vocab, an activation returnSelfToHand
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GOLLUM_PATIENT_PLOTTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GOLLUM_PATIENT_PLOTTER, "When Gollum leaves the battlefield, the Ring tempts you.\n{B}, Sacrifice a creature: Return this card from your graveyard to your hand. Activate only as a sorcery.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("The Ring tempts you.", GOLLUM_PATIENT_PLOTTER.name);
const VOCAB_T_L0 = vocabularyTargets("The Ring tempts you.");

export const GOLLUM_PATIENT_PLOTTER_SCRIPT: CardScript = {
  oracleId: GOLLUM_PATIENT_PLOTTER.oracleId,
  name: GOLLUM_PATIENT_PLOTTER.name,
  activated: [
    {
      ref: `${GOLLUM_PATIENT_PLOTTER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'graveyard') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'graveyard', player: me.owner }, to: { kind: 'hand', player: me.owner } }] }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'leavesBattlefield-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind !== 'battlefield'),
      label: () => "Gollum, Patient Plotter - The Ring tempts you.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
