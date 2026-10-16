//! Process information (name, path, command line, hosted services) and termination

use std::collections::{HashMap, HashSet};
use std::ffi::c_void;
use std::mem;
use std::slice;
use windows::{
    core::PWSTR,
    Win32::Foundation::{CloseHandle, HANDLE},
    Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    },
    Win32::System::RemoteDesktop::ProcessIdToSessionId,
    Win32::System::Services::{
        CloseServiceHandle, EnumServicesStatusExW, OpenSCManagerW, ENUM_SERVICE_STATUS_PROCESSW,
        SC_ENUM_PROCESS_INFO, SC_MANAGER_ENUMERATE_SERVICE, SERVICE_ACTIVE, SERVICE_WIN32,
    },
    Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, TerminateProcess, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_TERMINATE,
    },
};

/// PIDs that must never be terminated (System Idle Process, System)
const PROTECTED_PIDS: [u32; 2] = [0, 4];

const ERROR_MORE_DATA: i32 = 234;
const STATUS_INFO_LENGTH_MISMATCH: i32 = 0xC0000004_u32 as i32;
/// PROCESSINFOCLASS::ProcessCommandLineInformation (Windows 8.1+)
const PROCESS_COMMAND_LINE_INFORMATION: u32 = 60;

#[link(name = "ntdll")]
extern "system" {
    fn NtQueryInformationProcess(
        process: HANDLE,
        class: u32,
        info: *mut c_void,
        length: u32,
        return_length: *mut u32,
    ) -> i32;
}

#[derive(Clone, Default)]
pub struct ProcessInfo {
    pub name: String,
    pub path: String,
    pub command_line: String,
    /// Windows services hosted by this process (mostly svchost.exe)
    pub services: Vec<String>,
    /// Runs in session 0 (services and the OS itself), not in the user's desktop session
    pub is_system: bool,
}

struct SnapshotEntry {
    name: String,
    parent_pid: u32,
}

/// One pass over all running processes
fn process_snapshot() -> HashMap<u32, SnapshotEntry> {
    let mut entries = HashMap::new();

    unsafe {
        let Ok(snapshot) = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) else {
            return entries;
        };

        let mut entry = PROCESSENTRY32W {
            dwSize: mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };

        if Process32FirstW(snapshot, &mut entry).is_ok() {
            loop {
                entries.insert(
                    entry.th32ProcessID,
                    SnapshotEntry {
                        name: wide_to_string(&entry.szExeFile),
                        parent_pid: entry.th32ParentProcessID,
                    },
                );

                if Process32NextW(snapshot, &mut entry).is_err() {
                    break;
                }
            }
        }

        CloseHandle(snapshot).ok();
    }

    entries
}

/// Convert a NUL-terminated UTF-16 buffer
fn wide_to_string(buffer: &[u16]) -> String {
    let len = buffer.iter().position(|&c| c == 0).unwrap_or(buffer.len());
    String::from_utf16_lossy(&buffer[..len])
}

/// Map PID -> names of the services it hosts
fn service_names_by_pid() -> HashMap<u32, Vec<String>> {
    let mut services: HashMap<u32, Vec<String>> = HashMap::new();

    unsafe {
        let Ok(manager) = OpenSCManagerW(None, None, SC_MANAGER_ENUMERATE_SERVICE) else {
            return services;
        };

        let mut bytes_needed = 0u32;
        let mut count = 0u32;
        let mut resume = 0u32;
        // u64 storage keeps the buffer aligned for the structures it receives
        let mut buffer: Vec<u64> = Vec::new();

        loop {
            let bytes = slice::from_raw_parts_mut(buffer.as_mut_ptr() as *mut u8, buffer.len() * 8);
            let result = EnumServicesStatusExW(
                manager,
                SC_ENUM_PROCESS_INFO,
                SERVICE_WIN32,
                SERVICE_ACTIVE,
                if bytes.is_empty() { None } else { Some(bytes) },
                &mut bytes_needed,
                &mut count,
                Some(&mut resume),
                None,
            );

            let rows = slice::from_raw_parts(
                buffer.as_ptr() as *const ENUM_SERVICE_STATUS_PROCESSW,
                count as usize,
            );
            for row in rows {
                let pid = row.ServiceStatusProcess.dwProcessId;
                if pid != 0 {
                    if let Ok(name) = row.lpServiceName.to_string() {
                        services.entry(pid).or_default().push(name);
                    }
                }
            }

            match result {
                Ok(()) => break,
                Err(e) if e.code().0 & 0xFFFF == ERROR_MORE_DATA => {
                    buffer = vec![0u64; (bytes_needed as usize).div_ceil(8).max(buffer.len())];
                }
                Err(_) => break,
            }
        }

        CloseServiceHandle(manager).ok();
    }

    for names in services.values_mut() {
        names.sort();
    }
    services
}

/// Full executable path and command line, when the process can be opened
fn query_path_and_command_line(pid: u32) -> (Option<String>, Option<String>) {
    unsafe {
        let Ok(handle) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) else {
            return (None, None);
        };

        // Long paths can exceed MAX_PATH
        let mut path_buffer = vec![0u16; 32_768];
        let mut len = path_buffer.len() as u32;
        let path = QueryFullProcessImageNameW(
            handle,
            PROCESS_NAME_WIN32,
            PWSTR(path_buffer.as_mut_ptr()),
            &mut len,
        )
        .ok()
        .map(|_| String::from_utf16_lossy(&path_buffer[..len as usize]));

        let command_line = query_command_line(handle);
        CloseHandle(handle).ok();

        (path, command_line)
    }
}

/// Read the command line via ProcessCommandLineInformation, which returns a UNICODE_STRING
unsafe fn query_command_line(handle: HANDLE) -> Option<String> {
    #[repr(C)]
    struct UnicodeString {
        length: u16,
        maximum_length: u16,
        buffer: *const u16,
    }

    let mut needed = 0u32;
    let status = NtQueryInformationProcess(
        handle,
        PROCESS_COMMAND_LINE_INFORMATION,
        std::ptr::null_mut(),
        0,
        &mut needed,
    );
    if status != STATUS_INFO_LENGTH_MISMATCH || needed == 0 {
        return None;
    }

    let mut buffer = vec![0u64; (needed as usize).div_ceil(8)];
    let status = NtQueryInformationProcess(
        handle,
        PROCESS_COMMAND_LINE_INFORMATION,
        buffer.as_mut_ptr() as *mut c_void,
        (buffer.len() * 8) as u32,
        &mut needed,
    );
    if status < 0 {
        return None;
    }

    let header = &*(buffer.as_ptr() as *const UnicodeString);
    if header.buffer.is_null() || header.length == 0 {
        return None;
    }
    let chars = slice::from_raw_parts(header.buffer, header.length as usize / 2);
    Some(String::from_utf16_lossy(chars))
}

fn session_id(pid: u32) -> Option<u32> {
    let mut session = 0u32;
    unsafe { ProcessIdToSessionId(pid, &mut session).ok()? };
    Some(session)
}

/// Resolve process information for a set of PIDs, sharing one snapshot of the system
pub fn resolve_processes(pids: impl IntoIterator<Item = u32>) -> HashMap<u32, ProcessInfo> {
    let snapshot = process_snapshot();
    let services = service_names_by_pid();

    pids.into_iter()
        .collect::<HashSet<_>>()
        .into_iter()
        .map(|pid| (pid, resolve_process(pid, &snapshot, &services)))
        .collect()
}

fn resolve_process(
    pid: u32,
    snapshot: &HashMap<u32, SnapshotEntry>,
    services: &HashMap<u32, Vec<String>>,
) -> ProcessInfo {
    match pid {
        0 => {
            return ProcessInfo {
                name: "System Idle Process".to_string(),
                is_system: true,
                ..Default::default()
            }
        }
        4 => {
            return ProcessInfo {
                name: "System".to_string(),
                is_system: true,
                ..Default::default()
            }
        }
        _ => {}
    }

    let (path, command_line) = query_path_and_command_line(pid);
    let name = match (&path, snapshot.get(&pid)) {
        (Some(path), _) => path.rsplit('\\').next().unwrap_or(path).to_string(),
        (None, Some(entry)) => entry.name.clone(),
        (None, None) => format!("PID {}", pid),
    };

    ProcessInfo {
        name,
        path: path.unwrap_or_default(),
        command_line: command_line.unwrap_or_default(),
        services: services.get(&pid).cloned().unwrap_or_default(),
        // A process we cannot even query the session of is treated as a system process
        is_system: session_id(pid).is_none_or(|session| session == 0),
    }
}

fn ensure_killable(pid: u32) -> Result<(), String> {
    if PROTECTED_PIDS.contains(&pid) {
        return Err(format!("Process {} is a critical system process.", pid));
    }
    if pid == std::process::id() {
        return Err("Open Port cannot terminate itself.".to_string());
    }
    Ok(())
}

pub fn terminate_process(pid: u32) -> Result<(), String> {
    ensure_killable(pid)?;

    unsafe {
        let handle = OpenProcess(PROCESS_TERMINATE, false, pid).map_err(|e| {
            let error_code = e.code().0 as u32 & 0xFFFF;
            match error_code {
                // ERROR_ACCESS_DENIED
                5 => format!(
                    "Access denied. Process {} may require Administrator privileges or may be a system process.",
                    pid
                ),
                // ERROR_INVALID_PARAMETER: the process no longer exists
                87 => format!("Process {} no longer exists.", pid),
                _ => format!(
                    "Failed to open process {}: {} (Error code: {})",
                    pid, e, error_code
                ),
            }
        })?;

        let result = TerminateProcess(handle, 1);
        CloseHandle(handle).ok();

        result.map_err(|e| format!("Failed to terminate process {}: {}", pid, e))
    }
}

/// All descendants of `root`, deepest first
fn descendants(root: u32, snapshot: &HashMap<u32, SnapshotEntry>) -> Vec<u32> {
    let mut children: HashMap<u32, Vec<u32>> = HashMap::new();
    for (&pid, entry) in snapshot {
        if pid != entry.parent_pid {
            children.entry(entry.parent_pid).or_default().push(pid);
        }
    }

    let mut order = Vec::new();
    let mut visited = HashSet::from([root]);
    let mut stack = vec![root];
    while let Some(pid) = stack.pop() {
        for &child in children.get(&pid).into_iter().flatten() {
            // Guard against cycles caused by PID reuse
            if visited.insert(child) {
                order.push(child);
                stack.push(child);
            }
        }
    }

    order.reverse();
    order
}

/// Terminate a process and all of its descendants (like `taskkill /T`).
/// Returns how many processes were terminated.
pub fn terminate_process_tree(pid: u32) -> Result<usize, String> {
    ensure_killable(pid)?;

    let snapshot = process_snapshot();
    let mut killed = 0;
    for child in descendants(pid, &snapshot) {
        // Children may already have exited, or be protected; the root is what matters
        if ensure_killable(child).is_ok() && terminate_process(child).is_ok() {
            killed += 1;
        }
    }

    terminate_process(pid)?;
    Ok(killed + 1)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_current_process() {
        let pid = std::process::id();
        let info = resolve_processes([pid]).remove(&pid).unwrap();
        assert!(info.path.ends_with(".exe"));
        assert!(!info.command_line.is_empty());
        assert!(!info.is_system);
    }

    #[test]
    fn finds_hosted_services() {
        // svchost.exe processes always host at least one service
        let services = service_names_by_pid();
        assert!(services.values().any(|names| !names.is_empty()));
    }

    #[test]
    fn kills_a_process_tree() {
        // cmd.exe -> ping.exe, like npm -> node
        let mut parent = std::process::Command::new("cmd")
            .args(["/c", "ping -n 30 127.0.0.1 > nul"])
            .spawn()
            .unwrap();
        let parent_pid = parent.id();

        let child_pid = (0..50)
            .find_map(|_| {
                std::thread::sleep(std::time::Duration::from_millis(100));
                descendants(parent_pid, &process_snapshot()).first().copied()
            })
            .expect("ping should start as a child of cmd");

        assert_eq!(terminate_process_tree(parent_pid).unwrap(), 2);
        parent.wait().unwrap();
        std::thread::sleep(std::time::Duration::from_millis(200));
        assert!(!process_snapshot().contains_key(&child_pid));
    }

    #[test]
    fn refuses_to_kill_protected_processes() {
        assert!(terminate_process(0).is_err());
        assert!(terminate_process(4).is_err());
        assert!(terminate_process(std::process::id()).is_err());
        assert!(terminate_process_tree(std::process::id()).is_err());
    }
}
