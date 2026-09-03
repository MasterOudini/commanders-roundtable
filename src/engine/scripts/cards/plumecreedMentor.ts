// `Plumecreed Mentor` — Flying is the engine's. Whenever it or another flyer
// of mine enters (a card move OR a token, Bogwater Lumaret's pair), a +1/+1
// counter goes on a creature I control WITHOUT flying (D289). The entering
// creature's flying is DERIVED at match time — a Bears wearing flying
// counts, CR 613.

import { PLUMECREED_MENTOR } from '../../../data/fixtures/engineCards';
import { parseTargetClauses } from '../../../data/targetParse';
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

const PRINTED = printed(
  PLUMECREED_MENTOR,
  'Flying\nWhenever this creature or another creature you control with flying enters, put a +1/+1 counter on target creature you control without flying.',
);
const TEXT = PRINTED.split('\n')[1] as string;

const counter = (ctx: { state: { cards: Record<string, { zone: { kind: string } } | undefined> } }, obj: { targets: readonly { kind: string; id: string }[] }): readonly EventBody[] => {
  const target = obj.targets[0];
  if (!target || target.kind !== 'card') return [];
  return ctx.state.cards[target.id]?.zone.kind === 'battlefield'
    ? [{ t: 'CountersChanged', changes: [{ card: target.id, kind: '+1/+1', delta: 1 }] }]
    : [];
};

export const PLUMECREED_MENTOR_SCRIPT: CardScript = {
  oracleId: PLUMECREED_MENTOR.oracleId,
  name: PLUMECREED_MENTOR.name,
  triggers: [
    {
      abilityId: 'enters-card',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) => {
        if (ev.t !== 'CardsMoved') return false;
        const mine = ctx.query.controllerOf(self);
        return ev.moves.some((m) => {
          if (m.to.kind !== 'battlefield' || m.from.kind === 'battlefield') return false;
          if (m.card === self) return true;
          const card = ctx.state.cards[m.card];
          if (!card || card.controller !== mine) return false;
          const d = ctx.derive(m.card);
          return d.typeLine.types.includes('Creature') && d.keywords.has('flying');
        });
      },
      label: () => 'Plumecreed Mentor — a +1/+1 counter on target creature you control without flying',
      resolve: (ctx, _self, obj): readonly EventBody[] => counter(ctx, obj),
    },
    {
      abilityId: 'enters-token',
      text: TEXT,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) => {
        if (ev.t !== 'TokenCreated') return false;
        if (ev.controller !== ctx.query.controllerOf(self)) return false;
        const d = ctx.derive(ev.card);
        return d.typeLine.types.includes('Creature') && d.keywords.has('flying');
      },
      label: () => 'Plumecreed Mentor — a +1/+1 counter on target creature you control without flying',
      resolve: (ctx, _self, obj): readonly EventBody[] => counter(ctx, obj),
    },
  ],
};
