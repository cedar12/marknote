import { defineStore } from 'pinia';
import { isTauri } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { ElMessageBox } from 'element-plus';
import i18n from '../i18n';
import { getConfig, save as persistImagePreferences } from '../api/preferences';
import { DEFAULT_IMAGE_PATHS, IMAGE_PREFERENCES_KEY, readImagePreferences, validateImagePreferences, type ImagePreferences, type ImageSaveType } from '../utils/imagePreferences';

let loadTask: Promise<boolean> | null = null;
let pickerTitle = '';

export const useImagePreferencesStore = defineStore('imagePreferences', {
  state: () => ({
    saveType: 'default' as ImageSaveType,
    paths: { ...DEFAULT_IMAGE_PATHS },
    loaded: false, loading: false, saving: false, choosing: false,
    closePrompt: false,
    baseline: { saveType: 'default', path: DEFAULT_IMAGE_PATHS.default } as ImagePreferences,
    saved: false,
    errorKey: null as string | null,
    invalidPathKey: null as string | null,
    failedAction: null as 'load' | 'save' | 'choose' | null,
  }),
  getters: {
    busy: state => state.loading || state.saving || state.choosing,
    path: state => state.paths[state.saveType],
    dirty: state => state.loaded && (state.saveType !== state.baseline.saveType || state.paths[state.saveType].trim() !== state.baseline.path),
  },
  actions: {
    changeType(value: ImageSaveType) {
      if (this.busy || this.closePrompt || !['default', 'sepc', 'picgo'].includes(value)) return;
      this.saveType = value;
      this.changed();
    },
    changePath(value: string) { if (!this.busy && !this.closePrompt) { this.paths[this.saveType] = value; this.changed(); } },
    changed() { this.saved = false; this.errorKey = null; this.invalidPathKey = null; this.failedAction = null; },
    load(): Promise<boolean> {
      if (this.loaded) return Promise.resolve(true);
      if (loadTask) return loadTask;
      this.loading = true;
      this.errorKey = null;
      loadTask = (async () => {
        await Promise.resolve();
        try {
          let preference: ImagePreferences;
          if (isTauri()) {
            const response = await getConfig() as { code: number; data?: Record<string, string> };
            if (response.code !== 0 || !response.data) throw new Error('image_preferences_read_failed');
            const saveType = response.data.image_save_type || 'default';
            preference = readImagePreferences({ saveType, path: response.data.image_save_path || DEFAULT_IMAGE_PATHS[saveType as ImageSaveType] });
          } else {
            const cached = localStorage.getItem(IMAGE_PREFERENCES_KEY);
            preference = cached ? readImagePreferences(JSON.parse(cached)) : { saveType: 'default', path: DEFAULT_IMAGE_PATHS.default };
          }
          this.saveType = preference.saveType;
          this.paths[preference.saveType] = preference.path;
          this.baseline = { ...preference };
          this.loaded = true;
          this.failedAction = null;
          return true;
        } catch {
          this.errorKey = 'imagePreferencesLoadFailed';
          this.failedAction = 'load';
          return false;
        } finally { this.loading = false; loadTask = null; }
      })();
      return loadTask;
    },
    async save(): Promise<boolean> {
      if (this.busy || !this.loaded) return false;
      const preference: ImagePreferences = { saveType: this.saveType, path: this.path.trim() };
      this.invalidPathKey = validateImagePreferences(preference, (window as unknown as { os?: string }).os);
      if (this.invalidPathKey) { this.saved = false; this.errorKey = null; return false; }
      this.saving = true;
      this.saved = false;
      this.errorKey = null;
      try {
        if (isTauri()) {
          const response = await persistImagePreferences(preference.saveType, preference.path);
          if (response.code !== 0) {
            if (['imagePathRequired', 'imagePathInvalid', 'imagePathRelative', 'imagePathAbsolute', 'picgoPathInvalid'].includes(response.info || '')) {
              this.invalidPathKey = response.info || 'imagePathInvalid';
              this.failedAction = null;
              return false;
            }
            throw new Error('image_preferences_write_failed');
          }
        } else localStorage.setItem(IMAGE_PREFERENCES_KEY, JSON.stringify(preference));
        this.paths[preference.saveType] = preference.path;
        this.saved = true;
        this.baseline = { ...preference };
        this.failedAction = null;
        return true;
      } catch {
        this.errorKey = 'imagePreferencesSaveFailed';
        this.failedAction = 'save';
        return false;
      } finally { this.saving = false; }
    },
    async chooseDirectory(title: string): Promise<boolean> {
      if (this.busy || !this.loaded || this.saveType !== 'sepc') return false;
      this.choosing = true;
      this.errorKey = null;
      pickerTitle = title;
      try {
        const selected = await open({ directory: true, multiple: false, title });
        if (selected === null) return false;
        if (typeof selected !== 'string') throw new Error('unexpected_directory_picker_result');
        this.paths.sepc = selected;
        this.saved = false;
        this.invalidPathKey = null;
        this.failedAction = null;
        return true;
      } catch { this.errorKey = 'imageFolderPickerFailed'; this.failedAction = 'choose'; return false; }
      finally { this.choosing = false; }
    },
    async retry(): Promise<boolean> {
      if (this.failedAction === 'load') return this.load();
      if (this.failedAction === 'choose') return this.chooseDirectory(pickerTitle);
      return this.save();
    },
    async guardClose(): Promise<boolean> {
      if (this.busy || this.closePrompt) return false;
      if (!this.dirty) return true;
      this.closePrompt = true;
      const { t } = i18n.global;
      try {
        await ElMessageBox.confirm(t('imageUnsavedClose'), t('image'), {
          confirmButtonText: t('saveImageSettings'), cancelButtonText: t('imageDiscardSettings'),
          distinguishCancelAndClose: true, closeOnClickModal: false,
        });
        return await this.save();
      } catch (action) {
        // Discard is a decision for this close attempt. Keep the draft until the
        // complete settings guard succeeds, since a later shortcut prompt may cancel.
        return action === 'cancel';
      } finally { this.closePrompt = false; }
    },
  },
});
