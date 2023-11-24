import { defineStore } from 'pinia'

export const usePreferencesStore = defineStore('preferences', {
  state():{
    editor:{
      tabSize:number
    }
  }{
    return {
      editor:{
        tabSize: 4,
      }
    }
  },

});