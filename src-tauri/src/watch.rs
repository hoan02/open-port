//! Background watcher: notifies when a watched port starts or stops being used.
//! It runs in Rust so it keeps working while the window is hidden in the tray,
//! where webview timers are throttled.

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_notification::NotificationExt;

use crate::{net, process};

const POLL_INTERVAL: Duration = Duration::from_secs(2);

/// Localized notification texts, provided by the frontend.
/// `{port}` and `{process}` are replaced.
#[derive(serde::Deserialize, Clone)]
pub struct WatchLabels {
    pub in_use: String,
    pub freed: String,
}

impl Default for WatchLabels {
    fn default() -> Self {
        Self {
            in_use: "Port {port} is now used by {process}".to_string(),
            freed: "Port {port} is now free".to_string(),
        }
    }
}

#[derive(Default)]
pub struct WatchState {
    ports: BTreeSet<u16>,
    labels: WatchLabels,
    /// Last known owner PID of each watched port (None = free)
    last: BTreeMap<u16, Option<u32>>,
}

#[derive(serde::Serialize, Clone)]
pub struct WatchEvent {
    pub port: u16,
    pub in_use: bool,
    pub pid: Option<u32>,
    pub process_name: Option<String>,
}

pub type SharedWatchState = Mutex<WatchState>;

pub fn set_watched(state: &SharedWatchState, ports: Vec<u16>, labels: WatchLabels) {
    let mut state = state.lock().unwrap();
    state.ports = ports.into_iter().collect();
    state.labels = labels;
    // Forget ports that are no longer watched, so re-watching starts fresh
    let watched = state.ports.clone();
    state.last.retain(|port, _| watched.contains(port));
}

/// Which PID uses each watched port right now
fn current_owners(ports: &BTreeSet<u16>) -> Result<BTreeMap<u16, Option<u32>>, String> {
    let endpoints = net::all_endpoints()?;
    Ok(ports
        .iter()
        .map(|&port| {
            let owner = endpoints.iter().find(|e| e.port == port).map(|e| e.pid);
            (port, owner)
        })
        .collect())
}

fn poll(app: &AppHandle) {
    let state = app.state::<SharedWatchState>();
    let (ports, labels) = {
        let state = state.lock().unwrap();
        (state.ports.clone(), state.labels.clone())
    };
    if ports.is_empty() {
        return;
    }

    let Ok(owners) = current_owners(&ports) else {
        return;
    };

    let mut changes = Vec::new();
    {
        let mut state = state.lock().unwrap();
        for (&port, &owner) in &owners {
            match state.last.insert(port, owner) {
                // First observation: record silently
                None => {}
                Some(previous) if previous.is_some() != owner.is_some() => {
                    changes.push((port, owner));
                }
                Some(_) => {}
            }
        }
    }

    for (port, owner) in changes {
        let process_name = owner.map(|pid| {
            process::resolve_processes([pid])
                .remove(&pid)
                .map(|info| info.name)
                .unwrap_or_else(|| format!("PID {}", pid))
        });

        let body = match &process_name {
            Some(name) => labels
                .in_use
                .replace("{port}", &port.to_string())
                .replace("{process}", name),
            None => labels.freed.replace("{port}", &port.to_string()),
        };

        let _ = app
            .notification()
            .builder()
            .title("Open Port")
            .body(body)
            .show();

        let _ = app.emit(
            "watch-changed",
            WatchEvent {
                port,
                in_use: owner.is_some(),
                pid: owner,
                process_name,
            },
        );
    }
}

pub fn start(app: AppHandle) {
    std::thread::spawn(move || loop {
        poll(&app);
        std::thread::sleep(POLL_INTERVAL);
    });
}
