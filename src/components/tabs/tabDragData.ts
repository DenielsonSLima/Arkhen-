export const TAB_DRAG_MIME = 'application/x-contabil-module-tab';
export const TAB_REORDER_MIME = 'application/x-contabil-open-tab';

export interface TabDragPayload {
  id: string;
  title: string;
  iconName: string;
}

export function parseTabDragPayload(raw: string): TabDragPayload | null {
  try {
    const parsed = JSON.parse(raw) as Partial<TabDragPayload>;
    if (
      typeof parsed.id === 'string'
      && typeof parsed.title === 'string'
      && typeof parsed.iconName === 'string'
    ) {
      return {
        id: parsed.id,
        title: parsed.title,
        iconName: parsed.iconName,
      };
    }
  } catch {
    return null;
  }

  return null;
}
