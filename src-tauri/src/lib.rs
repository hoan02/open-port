mod elevation;
mod net;
mod process;
mod tray;
mod watch;

use std::collections::BTreeMap;
use tauri::{Manager, WindowEvent};
use tauri_plugin_window_state::StateFlags;

#[derive(serde::Serialize, Clone, PartialEq, Eq, Debug)]
struct PortInfo {
    port: u16,
    pid: u32,
    /// "TCP" or "UDP"
    protocol: &'static str,
    /// Every address this process binds the port on, e.g. ["0.0.0.0", "::"]
    local_addresses: Vec<String>,
    process_name: String,
    process_path: String,
    command_line: String,
    /// Windows services hosted by the process (svchost.exe)
    services: Vec<String>,
    /// Belongs to a service or the OS rather than the user's session
    is_system: bool,
}

fn collect_ports() -> Result<Vec<PortInfo>, String> {
    let endpoints = net::all_endpoints()?;

    // One row per (port, protocol, pid): the same socket bound on IPv4 and IPv6
    // (0.0.0.0 and ::) is a single thing from the user's point of view
    let mut grouped: BTreeMap<(u16, &'static str, u32), Vec<String>> = BTreeMap::new();
    for endpoint in endpoints {
        let addresses = grouped
            .entry((endpoint.port, endpoint.protocol, endpoint.pid))
            .or_default();
        if !addresses.contains(&endpoint.local_address) {
            addresses.push(endpoint.local_address);
        }
    }

    let processes = process::resolve_processes(grouped.keys().map(|&(_, _, pid)| pid));

    Ok(grouped
        .into_iter()
        .map(|((port, protocol, pid), mut local_addresses)| {
            // IPv4 before IPv6
            local_addresses.sort_by_key(|address| (address.contains(':'), address.clone()));
            let info = processes.get(&pid).cloned().unwrap_or_default();

            PortInfo {
                port,
                pid,
                protocol,
                local_addresses,
                process_name: info.name,
                process_path: info.path,
                command_line: info.command_line,
                services: info.services,
                is_system: info.is_system,
            }
        })
        .collect())
}

/// List all TCP ports in LISTENING state and all bound UDP ports (IPv4 and IPv6)
#[tauri::command]
async fn list_listening_ports() -> Result<Vec<PortInfo>, String> {
    // Run off the main thread so periodic polling never blocks the UI
    tauri::async_runtime::spawn_blocking(collect_ports)
        .await
        .map_err(|e| e.to_string())?
}

/// Kill a process by PID, optionally with all of its child processes.
/// Returns the number of processes terminated.
#[tauri::command]
async fn kill_process(pid: u32, tree: Option<bool>) -> Result<usize, String> {
    tauri::async_runtime::spawn_blocking(move || {
        if tree.unwrap_or(false) {
            process::terminate_process_tree(pid)
        } else {
            process::terminate_process(pid).map(|_| 1)
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn is_elevated() -> bool {
    elevation::is_elevated()
}

/// Restart Open Port with Administrator privileges
#[tauri::command]
fn relaunch_as_admin(app: tauri::AppHandle) -> Result<(), String> {
    elevation::relaunch_as_admin()?;
    app.exit(0);
    Ok(())
}

/// Ports to watch for changes, with localized notification texts
#[tauri::command]
fn set_watched_ports(
    state: tauri::State<'_, watch::SharedWatchState>,
    ports: Vec<u16>,
    labels: watch::WatchLabels,
) {
    watch::set_watched(&state, ports, labels);
}

#[tauri::command]
fn set_close_to_tray(state: tauri::State<'_, tray::CloseToTray>, enabled: bool) {
    state.set(enabled);
}

#[tauri::command]
fn set_tray_labels(app: tauri::AppHandle, show: String, quit: String) -> Result<(), String> {
    tray::set_labels(&app, &show, &quit).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    elevation::wait_for_previous_instance();

    tauri::Builder::default()
        // Must be registered first: a second launch focuses the running window instead
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            tray::show_main_window(app);
        }))
        .plugin(
            tauri_plugin_window_state::Builder::default()
                // Visibility is not restored: a window hidden to the tray must come back visible
                .with_state_flags(StateFlags::all() & !StateFlags::VISIBLE)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .manage(watch::SharedWatchState::default())
        .manage(tray::CloseToTray::default())
        .setup(|app| {
            tray::create(app.handle())?;
            watch::start(app.handle().clone());
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.state::<tray::CloseToTray>().enabled() {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            list_listening_ports,
            kill_process,
            is_elevated,
            relaunch_as_admin,
            set_watched_ports,
            set_close_to_tray,
            set_tray_labels
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn collects_listening_ports() {
        let ports = collect_ports().expect("port tables should be readable");
        assert!(!ports.is_empty());
        assert!(ports.iter().any(|p| p.protocol == "TCP"));
        assert!(ports.iter().any(|p| p.protocol == "UDP"));
        assert!(ports.iter().all(|p| !p.process_name.is_empty()));
        assert!(ports.iter().all(|p| !p.local_addresses.is_empty()));
        // System (PID 4) always binds something, e.g. 445/SMB
        assert!(ports.iter().any(|p| p.is_system));
    }

    #[test]
    fn merges_ipv4_and_ipv6_of_the_same_socket() {
        let ports = collect_ports().unwrap();
        let mut seen = std::collections::HashSet::new();
        for p in &ports {
            assert!(seen.insert((p.port, p.protocol, p.pid)), "duplicate row {:?}", p);
        }
    }
}
