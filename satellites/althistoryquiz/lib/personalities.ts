import type { Personality } from './questions';

export interface PersonalityInfo {
  title: string;
  description: string;
  emoji: string;
  color: string;
}

export const PERSONALITIES: Record<Personality, PersonalityInfo> = {
  divergent: {
    title: 'Timeline Divergent',
    description:
      'You see infinite possibilities in every moment of history. Where others see a single path, you see a branching tree of could-have-beens stretching to the horizon. Your imagination thrives in the space between what happened and what almost happened. You\'re the person at the dinner party saying "but what if..." and making everyone rethink everything they thought they knew.',
    emoji: '\u{1F300}',
    color: '#7C3AED',
  },
  preserver: {
    title: 'History Preserver',
    description:
      'You believe the past unfolded as it should, shaped by deep forces that no single event could truly derail. You respect the weight of historical momentum and understand that human nature is the one true constant. While others dream of alternate timelines, you find wisdom in understanding why things happened the way they did. You\'re the voice of reason in a world of speculation.',
    emoji: '\u{1F6E1}\u{FE0F}',
    color: '#059669',
  },
  agent: {
    title: 'Chaos Agent',
    description:
      'You thrive on disruption and see history as a powder keg always one spark away from explosion. You understand that small changes can cascade into world-shattering consequences, and frankly, you find that thrilling. Your alternate histories tend toward the dramatic, the catastrophic, and the wildly unpredictable. You know that the most interesting stories come from the biggest disruptions.',
    emoji: '\u{1F525}',
    color: '#DC2626',
  },
  visionary: {
    title: 'Future Architect',
    description:
      'You look at the past to engineer a better future. Every historical "what if" is really a blueprint for what could still be. You see missed opportunities everywhere and believe humanity\'s best days are always ahead. Your alternate histories aren\'t just fantasies — they\'re roadmaps. You\'re the kind of person who reads history books and takes notes for tomorrow.',
    emoji: '\u{1F52D}',
    color: '#2563EB',
  },
};
