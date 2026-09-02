// `The Immortal Weapons` — the entry returns an instant or sorcery from my
// graveyard to my hand; each noncreature spell I cast aims +2/+0 and menace
// at a creature.

import { THE_IMMORTAL_WEAPONS } from '../../../data/fixtures/engineCards';
import { parseTargetClauses } from '../../../data/targetParse';
import { faceOf } from '../../oracle';
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
  THE_IMMORTAL_WEAPONS,
  "When The Immortal Weapons enter, return target instant or sorcery card from your graveyard to your hand.\nWhenever you cast a noncreature spell, target creature gets +2/+0 and gains menace until end of turn. (It can't be blocked except by two or more creatures.)",
);
const ENTERS = PRINTED.split('\n')[0] as string;
const CAST = PRINTED.split('\n')[1] as string;

export const THE_IMMORTAL_WEAPONS_SCRIPT: CardScript = {
  oracleId: THE_IMMORTAL_WEAPONS.oracleId,
  name: THE_IMMORTAL_WEAPONS.name,
  triggers: [
    {
      abilityId: 'enters-return',
      text: ENTERS,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(ENTERS),
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'The Immortal Weapons — return an instant or sorcery to your hand',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'graveyard') return [];
        return [
          {
            t: 'CardsMoved',
            moves: [
              {
                card: target.id,
                from: { kind: 'graveyard', player: card.owner },
                to: { kind: 'hand', player: card.owner },
              },
            ],
          },
        ];
      },
    },
    {
      abilityId: 'noncreature-cast',
      text: CAST,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(CAST),
      matches: (ctx, self, ev) => {
        if (ev.t !== 'SpellCast') return false;
        if (ev.obj.controller !== ctx.query.controllerOf(self)) return false;
        if (!ev.obj.card) return false;
        const inst = ctx.state.cards[ev.obj.card];
        const oc = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
        if (!oc) return false;
        return !faceOf(oc, ev.obj.faceIndex).typeLine.types.includes('Creature');
      },
      label: () => 'The Immortal Weapons — +2/+0 and menace to a creature',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 0, keywords: ['menace'] }];
      },
    },
  ],
};
