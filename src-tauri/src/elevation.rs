//! Administrator privileges: detection and relaunching elevated

use std::mem;
use std::os::windows::ffi::OsStrExt;
use windows::{
    core::{w, PCWSTR},
    Win32::Foundation::{CloseHandle, HANDLE},
    Win32::Security::{GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY},
    Win32::System::Threading::{
        GetCurrentProcess, OpenProcess, OpenProcessToken, WaitForSingleObject,
        PROCESS_SYNCHRONIZE,
    },
    Win32::UI::Shell::ShellExecuteW,
    Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL,
};

/// Command-line flag passed to the elevated instance so it waits for the old one to exit
pub const WAIT_FOR_PID_ARG: &str = "--wait-for-pid";

pub fn is_elevated() -> bool {
    unsafe {
        let mut token = HANDLE::default();
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token).is_err() {
            return false;
        }

        let mut elevation = TOKEN_ELEVATION::default();
        let mut returned = 0u32;
        let result = GetTokenInformation(
            token,
            TokenElevation,
            Some(&mut elevation as *mut _ as *mut _),
            mem::size_of::<TOKEN_ELEVATION>() as u32,
            &mut returned,
        );
        CloseHandle(token).ok();

        result.is_ok() && elevation.TokenIsElevated != 0
    }
}

fn to_wide(value: &std::ffi::OsStr) -> Vec<u16> {
    value.encode_wide().chain(std::iter::once(0)).collect()
}

/// Start a new elevated instance (shows the UAC prompt).
/// The caller should exit right after this returns Ok.
pub fn relaunch_as_admin() -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let args = format!("{} {}", WAIT_FOR_PID_ARG, std::process::id());

    let exe_wide = to_wide(exe.as_os_str());
    let args_wide = to_wide(std::ffi::OsStr::new(&args));

    // ShellExecuteW blocks while the UAC prompt is shown; > 32 means success
    let result = unsafe {
        ShellExecuteW(
            None,
            w!("runas"),
            PCWSTR(exe_wide.as_ptr()),
            PCWSTR(args_wide.as_ptr()),
            None,
            SW_SHOWNORMAL,
        )
    };

    if result.0 as isize > 32 {
        Ok(())
    } else {
        Err("The elevation request was cancelled or failed.".to_string())
    }
}

/// When launched by `relaunch_as_admin`, wait for the previous instance to exit so the
/// single-instance check does not hand control back to it.
pub fn wait_for_previous_instance() {
    let args: Vec<String> = std::env::args().collect();
    let Some(index) = args.iter().position(|arg| arg == WAIT_FOR_PID_ARG) else {
        return;
    };
    let Some(pid) = args.get(index + 1).and_then(|pid| pid.parse::<u32>().ok()) else {
        return;
    };

    unsafe {
        if let Ok(handle) = OpenProcess(PROCESS_SYNCHRONIZE, false, pid) {
            WaitForSingleObject(handle, 5_000);
            CloseHandle(handle).ok();
        }
    }
}
