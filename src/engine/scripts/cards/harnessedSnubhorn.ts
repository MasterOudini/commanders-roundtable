// `Harnessed Snubhorn` - "Whenever this creature deals combat damage to a player,
// return target artifact or enchantment card from your graveyard to the
// battlefield." - a targeted combat-damage trigger (belligerentGuest's event);
// the card list is D298's ("card" distributes over the list). Vigilance is the engine's.

import { HARNESSED_SNUBHORN } from '../../../data/fixtures/engineCards';
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
  HARNESSED_SNUBHORN,
  'Vigilance\nWhenever this creature deals combat damage to a player, return target artifact or enchantment card from your graveyard to the battlefield.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const HARNESSED_SNUBHORN_SCRIPT: CardScript = {
  oracleId: HARNESSED_SNUBHORN.oracleId,
  name: HARNESSED_SNUBHORN.name,
  triggers: [
    {
      abilityId: 'combat-damage-to-player',
      text: TEXT,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (_ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => 'Harnessed Snubhorn - return an artifact or enchantment card to the battlefield',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'graveyard') return [];
        return [{ t: 'CardsMoved', moves: [{ card: target.id, from: { kind: 'graveyard', player: card.owner }, to: { kind: 'battlefield', player: obj.controller } }] }];
      },
    },
  ],
};
