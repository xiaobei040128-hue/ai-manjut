import stories from './storyCatalog.json';

export function readStoryFavorites(ownerId: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(`studio-story-favorites-v1:${ownerId}`) || '[]');
    return Array.isArray(value)
      ? [...new Set(value.filter((id): id is string => typeof id === 'string' && stories.some(story => story.id === id)))]
      : [];
  } catch {
    return [];
  }
}
