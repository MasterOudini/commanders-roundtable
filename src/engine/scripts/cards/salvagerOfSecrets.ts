// `Salvager of Secrets` — "When this creature enters, return target
// instant or sorcery card from your graveyard to your hand." The ETB
// graveyard return with cardTypes ENFORCED (probed: Instant+Sorcery both
// carried). D243.

import { SALVAGER_OF_SECRETS } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  SALVAGER_OF_SECRETS,
  'When this creature enters, return target instant or sorcery card from your graveyard to your hand.',
);

export const SALVAGER_OF_SECRETS_SCRIPT: CardScript = {
  oracleId: SALVAGER_OF_SECRETS.oracleId,
  name: SALVAGER_OF_SECRETS.name,
  triggers: [
    {
      abilityId: 'etb-return',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Salvager of Secrets — return an instant or sorcery to your hand',
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
};
