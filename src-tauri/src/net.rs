//! Reading the TCP/UDP socket tables from the IP Helper API

use std::ffi::c_void;
use std::net::{Ipv4Addr, Ipv6Addr};
use std::ptr;
use std::slice;
use windows::Win32::NetworkManagement::IpHelper::{
    GetExtendedTcpTable, GetExtendedUdpTable, MIB_TCP6ROW_OWNER_PID, MIB_TCP6TABLE_OWNER_PID,
    MIB_TCPROW_OWNER_PID, MIB_TCPTABLE_OWNER_PID, MIB_UDP6ROW_OWNER_PID, MIB_UDP6TABLE_OWNER_PID,
    MIB_UDPROW_OWNER_PID, MIB_UDPTABLE_OWNER_PID, TCP_TABLE_OWNER_PID_ALL, UDP_TABLE_OWNER_PID,
};
use windows::Win32::Networking::WinSock::{AF_INET, AF_INET6};

const ERROR_SUCCESS: u32 = 0;
const ERROR_NOT_SUPPORTED: u32 = 50;
const ERROR_INSUFFICIENT_BUFFER: u32 = 122;
const MIB_TCP_STATE_LISTEN: u32 = 2;

/// A raw socket entry before process information is resolved
pub struct Endpoint {
    pub protocol: &'static str,
    pub local_address: String,
    pub port: u16,
    pub pid: u32,
}

/// Call an IP Helper table function, growing the buffer until the table fits.
/// The buffer is `Vec<u32>` so it is correctly aligned for the MIB structures.
fn fetch_table(
    mut call: impl FnMut(Option<*mut c_void>, &mut u32) -> u32,
) -> Result<Vec<u32>, u32> {
    let mut size: u32 = 0;
    let mut buffer: Vec<u32> = Vec::new();

    // The table can grow between calls, so retry a few times
    for _ in 0..5 {
        let table_ptr = if buffer.is_empty() {
            None
        } else {
            Some(buffer.as_mut_ptr() as *mut c_void)
        };

        match call(table_ptr, &mut size) {
            ERROR_SUCCESS => return Ok(buffer),
            ERROR_NOT_SUPPORTED => return Ok(Vec::new()),
            ERROR_INSUFFICIENT_BUFFER => {
                buffer = vec![0u32; (size as usize).div_ceil(4)];
            }
            code => return Err(code),
        }
    }

    Err(ERROR_INSUFFICIENT_BUFFER)
}

/// View the rows of a MIB_*TABLE_OWNER_PID buffer as a slice
macro_rules! table_rows {
    ($buffer:expr, $table:ty, $row:ty) => {{
        let buffer: &[u32] = &$buffer;
        if buffer.is_empty() {
            &[] as &[$row]
        } else {
            let table = buffer.as_ptr() as *const $table;
            slice::from_raw_parts(
                ptr::addr_of!((*table).table) as *const $row,
                (*table).dwNumEntries as usize,
            )
        }
    }};
}

/// Convert a port from network byte order to host byte order
fn port_from_raw(raw: u32) -> u16 {
    u16::from_be((raw & 0xFFFF) as u16)
}

fn ipv4_from_raw(raw: u32) -> String {
    // dwLocalAddr is stored in network byte order
    Ipv4Addr::from(raw.to_ne_bytes()).to_string()
}

fn ipv6_from_raw(raw: [u8; 16]) -> String {
    Ipv6Addr::from(raw).to_string()
}

fn tcp_endpoints(family: u32) -> Result<Vec<Endpoint>, String> {
    let buffer = fetch_table(|table, size| unsafe {
        GetExtendedTcpTable(table, size, false, family, TCP_TABLE_OWNER_PID_ALL, 0)
    })
    .map_err(|code| format!("Failed to read TCP table (error {})", code))?;

    let endpoints = unsafe {
        if family == AF_INET.0 as u32 {
            table_rows!(buffer, MIB_TCPTABLE_OWNER_PID, MIB_TCPROW_OWNER_PID)
                .iter()
                .filter(|row| row.dwState == MIB_TCP_STATE_LISTEN)
                .map(|row| Endpoint {
                    protocol: "TCP",
                    local_address: ipv4_from_raw(row.dwLocalAddr),
                    port: port_from_raw(row.dwLocalPort),
                    pid: row.dwOwningPid,
                })
                .collect()
        } else {
            table_rows!(buffer, MIB_TCP6TABLE_OWNER_PID, MIB_TCP6ROW_OWNER_PID)
                .iter()
                .filter(|row| row.dwState == MIB_TCP_STATE_LISTEN)
                .map(|row| Endpoint {
                    protocol: "TCP",
                    local_address: ipv6_from_raw(row.ucLocalAddr),
                    port: port_from_raw(row.dwLocalPort),
                    pid: row.dwOwningPid,
                })
                .collect()
        }
    };

    Ok(endpoints)
}

fn udp_endpoints(family: u32) -> Result<Vec<Endpoint>, String> {
    let buffer = fetch_table(|table, size| unsafe {
        GetExtendedUdpTable(table, size, false, family, UDP_TABLE_OWNER_PID, 0)
    })
    .map_err(|code| format!("Failed to read UDP table (error {})", code))?;

    // UDP has no connection state: every bound socket can receive datagrams
    let endpoints = unsafe {
        if family == AF_INET.0 as u32 {
            table_rows!(buffer, MIB_UDPTABLE_OWNER_PID, MIB_UDPROW_OWNER_PID)
                .iter()
                .map(|row| Endpoint {
                    protocol: "UDP",
                    local_address: ipv4_from_raw(row.dwLocalAddr),
                    port: port_from_raw(row.dwLocalPort),
                    pid: row.dwOwningPid,
                })
                .collect()
        } else {
            table_rows!(buffer, MIB_UDP6TABLE_OWNER_PID, MIB_UDP6ROW_OWNER_PID)
                .iter()
                .map(|row| Endpoint {
                    protocol: "UDP",
                    local_address: ipv6_from_raw(row.ucLocalAddr),
                    port: port_from_raw(row.dwLocalPort),
                    pid: row.dwOwningPid,
                })
                .collect()
        }
    };

    Ok(endpoints)
}

/// All listening TCP sockets and bound UDP sockets, IPv4 and IPv6
pub fn all_endpoints() -> Result<Vec<Endpoint>, String> {
    let ipv4 = AF_INET.0 as u32;
    let ipv6 = AF_INET6.0 as u32;

    let mut endpoints = tcp_endpoints(ipv4)?;
    endpoints.extend(tcp_endpoints(ipv6)?);
    endpoints.extend(udp_endpoints(ipv4)?);
    endpoints.extend(udp_endpoints(ipv6)?);
    Ok(endpoints)
}
