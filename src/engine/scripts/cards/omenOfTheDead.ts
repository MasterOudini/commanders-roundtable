// `Omen of the Dead` — "Flash\nWhen this enchantment enters, return target
// creature card from your graveyard to your hand.\n{2}{B}, Sacrifice this
// enchantment: Scry 2." Golgari Guildmage's graveyard-to-HAND aim (D277) on a
// targeted entry (the ask goes up as the trigger does, D147), and a
// self-sacrifice scry 2 with the ask LAST (D195). Flash is the engine's. D278.

import { OMEN_OF_THE_DEAD } from '../../../data/fixtures/engineCards';
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
  OMEN_OF_THE_DEAD,
  'Flash\nWhen this enchantment enters, return target creature card from your graveyard to your hand.\n{2}{B}, Sacrifice this enchantment: Scry 2.',
);
const ENTERS = PRINTED.split('\n')[1] as string;
const SCRY = PRINTED.split('\n')[2] as string;

export const OMEN_OF_THE_DEAD_SCRIPT: CardScript = {
  oracleId: OMEN_OF_THE_DEAD.oracleId,
  name: OMEN_OF_THE_DEAD.name,
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
      label: () => 'Omen of the Dead — return target creature card from your graveyard to your hand',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'graveyard') return [];
        const graveOwner = card.zone.player;
        if (!graveOwner) return [];
        return [
          {
            t: 'CardsMoved',
            moves: [
              {
                card: target.id,
                from: { kind: 'graveyard', player: graveOwner },
                to: { kind: 'hand', player: card.owner },
              },
            ],
          },
        ];
      },
    },
  ],
  activated: [
    {
      ref: `${OMEN_OF_THE_DEAD.oracleId}#a0`,
      text: SCRY,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(2, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          {
            t: 'AwaitingSet',
            awaiting: {
              kind: 'scryChoice',
              player: obj.controller,
              count: n,
              toGraveyard: false,
              thenDraw: 0,
              label: obj.label,
            },
          },
        ];
      },
    },
  ],
};
