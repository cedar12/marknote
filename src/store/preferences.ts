import { defineStore } from 'pinia'

export type SegmentNavigationMode = 'buttons' | 'scroll';

const SEGMENT_NAVIGATION_MODE_KEY = 'segmentNavigationMode';

function savedSegmentNavigationMode(): SegmentNavigationMode {
  return localStorage.getItem(SEGMENT_NAVIGATION_MODE_KEY) === 'scroll' ? 'scroll' : 'buttons';
}

export const usePreferencesStore = defineStore('preferences', {
  state():{
    editor:{
      tabSize:number,
      segmentNavigationMode:SegmentNavigationMode,
    }
  }{
    return {
      editor:{
        tabSize: 4,
        segmentNavigationMode: savedSegmentNavigationMode(),
      }
    }
  },

  actions: {
    setSegmentNavigationMode(mode: SegmentNavigationMode) {
      if (mode !== 'buttons' && mode !== 'scroll') return;
      this.editor.segmentNavigationMode = mode;
      localStorage.setItem(SEGMENT_NAVIGATION_MODE_KEY, mode);
    },
  },
});
