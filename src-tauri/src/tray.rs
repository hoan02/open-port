//! System tray icon and "close to tray" behaviour

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Wry,
};

const TRAY_ID: &str = "main";
const MENU_SHOW: &str = "show";
const MENU_QUIT: &str = "quit";

/// Whether closing the window hides it to the tray instead of quitting
#[derive(Default)]
pub struct CloseToTray(pub AtomicBool);

impl CloseToTray {
    pub fn enabled(&self) -> bool {
        self.0.load(Ordering::Relaxed)
    }

    pub fn set(&self, enabled: bool) {
        self.0.store(enabled, Ordering::Relaxed)
    }
}

/// Bring the main window back from the tray, minimized state or the background
pub fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn build_menu(app: &AppHandle, show_label: &str, quit_label: &str) -> tauri::Result<Menu<Wry>> {
    let show = MenuItem::with_id(app, MENU_SHOW, show_label, true, None::<&str>)?;
    let quit = MenuItem::with_id(app, MENU_QUIT, quit_label, true, None::<&str>)?;
    Menu::with_items(app, &[&show, &quit])
}

pub fn create(app: &AppHandle) -> tauri::Result<TrayIcon> {
    let menu = build_menu(app, "Open Open Port", "Quit")?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("Open Port")
        .menu(&menu)
        // Left click shows the window, right click opens the menu
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            MENU_SHOW => show_main_window(app),
            MENU_QUIT => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)
}

/// Localize the tray menu (the frontend owns the translations)
pub fn set_labels(app: &AppHandle, show_label: &str, quit_label: &str) -> tauri::Result<()> {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        tray.set_menu(Some(build_menu(app, show_label, quit_label)?))?;
    }
    Ok(())
}
