// `Teacher's Pest` - a attacks trigger gainLife, an activation returnSelfFromGraveyard
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TEACHER_S_PEST } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
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

const PRINTED = printed(TEACHER_S_PEST, "Menace (This creature can't be blocked except by two or more creatures.)\nWhenever this creature attacks, you gain 1 life.\n{B}{G}: Return this card from your graveyard to the battlefield tapped.");
const LINES = PRINTED.split('\n');

export const TEACHERS_PEST_SCRIPT: CardScript = {
  oracleId: TEACHER_S_PEST.oracleId,
  name: TEACHER_S_PEST.name,
  activated: [
    {
      ref: `${TEACHER_S_PEST.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'graveyard') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'graveyard', player: me.owner }, to: { kind: 'battlefield', player: obj.controller } }] }, { t: 'PermanentsTapped', cards: [self] }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Teacher's Pest - gain life",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: me.life + 1 }];
      },
    },
  ],
};
