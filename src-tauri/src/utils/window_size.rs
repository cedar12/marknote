//! Remember client dimensions in logical pixels, independently of document state.
use crate::{
    db,
    utils::{HEIGHT, MIN_HEIGTH, MIN_WIDTH, WIDTH},
};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::Mutex};
use tauri::{LogicalSize, WebviewWindow, Window, WindowEvent};

const CONFIG_KEY: &str = "document_window_size";
const MAX_SIZE: f64 = 16384.0;

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct WindowSize {
    pub width: f64,
    pub height: f64,
}

impl Default for WindowSize {
    fn default() -> Self {
        Self {
            width: WIDTH,
            height: HEIGHT,
        }
    }
}

impl WindowSize {
    fn valid(self) -> bool {
        self.width.is_finite()
            && self.height.is_finite()
            && self.width >= 40.0
            && self.height >= 40.0
            && self.width <= MAX_SIZE
            && self.height <= MAX_SIZE
    }

    fn from_physical(width: u32, height: u32, scale: f64) -> Option<Self> {
        if !scale.is_finite() || scale <= 0.0 {
            return None;
        }
        let size = Self {
            width: width as f64 / scale,
            height: height as f64 / scale,
        };
        size.valid().then_some(size)
    }

    fn fit(self, available_width: f64, available_height: f64) -> Self {
        if !available_width.is_finite()
            || !available_height.is_finite()
            || available_width <= 0.0
            || available_height <= 0.0
        {
            return self;
        }
        Self {
            width: self
                .width
                .clamp(MIN_WIDTH.min(available_width), available_width),
            height: self
                .height
                .clamp(MIN_HEIGTH.min(available_height), available_height),
        }
    }
}

lazy_static! {
    static ref WINDOWS: Mutex<HashMap<String, WindowSize>> = Mutex::new(HashMap::new());
    static ref LAST_SIZE: Mutex<Option<WindowSize>> = Mutex::new(None);
}

pub fn is_document_window(label: &str) -> bool {
    label == "main"
        || label
            .strip_prefix("window_")
            .map(|id| !id.is_empty() && id.chars().all(|character| character.is_ascii_digit()))
            .unwrap_or(false)
}

fn parse(value: &str) -> Option<WindowSize> {
    serde_json::from_str::<WindowSize>(value)
        .ok()
        .filter(|size| size.valid())
}

pub fn remembered_size() -> WindowSize {
    if let Ok(last) = LAST_SIZE.lock() {
        if let Some(size) = *last {
            return size;
        }
    }
    match db::config_get(CONFIG_KEY) {
        Ok(Some(value)) => parse(&value).unwrap_or_default(),
        Ok(None) => WindowSize::default(),
        Err(error) => {
            log::warn!("could not read window size: {}", error);
            WindowSize::default()
        }
    }
}

fn persist(size: WindowSize) -> Result<(), String> {
    // Serialize saves so two closing windows cannot leave the disk and memory
    // defaults describing different windows.
    let mut last = LAST_SIZE.lock().map_err(|_| "window size lock failed")?;
    *last = Some(size);
    let json = serde_json::to_string(&size).map_err(|error| error.to_string())?;
    db::config_set_value(CONFIG_KEY, &json)
}

/// Restore while still hidden, using the destination display's available area.
pub fn restore(window: &WebviewWindow) -> Result<(), String> {
    if !is_document_window(window.label()) {
        return Ok(());
    }
    let mut size = remembered_size();
    let monitor = window
        .current_monitor()
        .map_err(|error| error.to_string())?
        .or(window
            .primary_monitor()
            .map_err(|error| error.to_string())?);
    if let Some(monitor) = monitor {
        let scale = window.scale_factor().map_err(|error| error.to_string())?;
        let inner = window.inner_size().map_err(|error| error.to_string())?;
        let outer = window.outer_size().map_err(|error| error.to_string())?;
        let work_area = monitor.work_area().size;
        let frame_width = outer.width.saturating_sub(inner.width) as f64 / scale;
        let frame_height = outer.height.saturating_sub(inner.height) as f64 / scale;
        let available_width = work_area.width as f64 / monitor.scale_factor() - frame_width;
        let available_height = work_area.height as f64 / monitor.scale_factor() - frame_height;
        size = size.fit(available_width, available_height);
        window
            .set_min_size(Some(LogicalSize::new(
                MIN_WIDTH.min(size.width),
                MIN_HEIGTH.min(size.height),
            )))
            .map_err(|error| error.to_string())?;
    }
    window
        .set_size(LogicalSize::new(size.width, size.height))
        .map_err(|error| error.to_string())?;
    window.center().map_err(|error| error.to_string())?;
    WINDOWS
        .lock()
        .map_err(|_| "window size lock failed")?
        .entry(window.label().to_string())
        .or_insert(size);
    Ok(())
}

/// Track without writing on every drag; minimized/zero-size events are ignored.
pub fn on_window_event(window: &Window, event: &WindowEvent) {
    if !is_document_window(window.label()) {
        return;
    }
    let size = match event {
        WindowEvent::Resized(size) if window.is_minimized().ok() == Some(false) => window
            .scale_factor()
            .ok()
            .and_then(|scale| WindowSize::from_physical(size.width, size.height, scale)),
        WindowEvent::ScaleFactorChanged {
            scale_factor,
            new_inner_size,
            ..
        } if window.is_minimized().ok() == Some(false) => {
            WindowSize::from_physical(new_inner_size.width, new_inner_size.height, *scale_factor)
        }
        WindowEvent::Destroyed => {
            let size = WINDOWS
                .lock()
                .ok()
                .and_then(|mut windows| windows.remove(window.label()));
            if let Some(size) = size {
                if let Err(error) = persist(size) {
                    log::warn!("could not remember window size: {}", error);
                }
            }
            None
        }
        _ => None,
    };
    if let Some(size) = size {
        if let Ok(mut windows) = WINDOWS.lock() {
            windows.insert(window.label().to_string(), size);
        }
    }
}

/// The frontend awaits this before making a newly created window visible.
#[tauri::command(async)]
pub fn restore_window_size(window: WebviewWindow) -> Result<(), String> {
    restore(&window)
}

/// Await before approved close, quit or updater installation can destroy windows.
#[tauri::command(async)]
pub fn remember_window_size(window: Window) -> Result<(), String> {
    if !is_document_window(window.label()) {
        return Ok(());
    }
    let current = if window.is_minimized().map_err(|error| error.to_string())? {
        None
    } else {
        let physical = window.inner_size().map_err(|error| error.to_string())?;
        WindowSize::from_physical(
            physical.width,
            physical.height,
            window.scale_factor().map_err(|error| error.to_string())?,
        )
    };
    let mut windows = WINDOWS.lock().map_err(|_| "window size lock failed")?;
    let size = current
        .or_else(|| windows.get(window.label()).copied())
        .unwrap_or_default();
    windows.insert(window.label().to_string(), size);
    drop(windows);
    persist(size)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn data_and_window_scope_are_validated() {
        assert_eq!(
            parse(r#"{"width":1234.5,"height":678}"#),
            Some(WindowSize {
                width: 1234.5,
                height: 678.0
            })
        );
        for invalid in [
            "null",
            "{}",
            r#"{"width":0,"height":800}"#,
            r#"{"width":800,"height":100000}"#,
            r#"{"width":800,"height":800,"x":0}"#,
        ] {
            assert!(parse(invalid).is_none());
        }
        assert!(is_document_window("main"));
        assert!(is_document_window("window_12"));
        for label in ["preferences", "about", "window_", "window_bad"] {
            assert!(!is_document_window(label));
        }
    }
    #[test]
    fn dimensions_use_logical_pixels_and_ignore_minimized_sizes() {
        assert_eq!(
            WindowSize::from_physical(1800, 1200, 1.5),
            Some(WindowSize {
                width: 1200.0,
                height: 800.0
            })
        );
        for scale in [0.0, -1.0, f64::NAN, f64::INFINITY] {
            assert!(WindowSize::from_physical(800, 800, scale).is_none());
        }
        assert!(WindowSize::from_physical(0, 0, 1.0).is_none());
        assert!(WindowSize::from_physical(160, 28, 1.0).is_none());
    }
    #[test]
    fn restoration_fits_changed_and_small_displays() {
        let size = WindowSize {
            width: 1200.0,
            height: 850.0,
        };
        assert_eq!(size.fit(1600.0, 1000.0), size);
        assert_eq!(
            size.fit(900.0, 650.0),
            WindowSize {
                width: 900.0,
                height: 650.0
            }
        );
        assert_eq!(
            size.fit(350.0, 250.0),
            WindowSize {
                width: 350.0,
                height: 250.0
            }
        );
        assert_eq!(size.fit(f64::NAN, 0.0), size);
        let small = size.fit(350.0, 650.0);
        assert_eq!(parse(&serde_json::to_string(&small).unwrap()), Some(small));
        assert_eq!(
            small.fit(1600.0, 1000.0),
            WindowSize {
                width: 500.0,
                height: 650.0
            }
        );
    }
}
