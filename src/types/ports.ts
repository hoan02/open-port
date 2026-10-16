export type PortProtocol = "TCP" | "UDP";

export type ProtocolFilter = "all" | PortProtocol;

export interface PortInfo {
  port: number;
  pid: number;
  protocol: PortProtocol;
  /** Every address the port is bound on, IPv4 first, e.g. ["0.0.0.0", "::"] */
  local_addresses: string[];
  process_name: string;
  process_path: string;
  command_line: string;
  /** Windows services hosted by the process (svchost.exe) */
  services: string[];
  /** Belongs to a service or the OS rather than the user's session */
  is_system: boolean;
}

/** Unique key for a row: the backend merges IPv4/IPv6 sockets per (protocol, port, pid) */
export function portKey(port: PortInfo): string {
  return `${port.protocol}-${port.port}-${port.pid}`;
}

/** Format "address:port", wrapping IPv6 addresses in brackets */
export function formatEndpoint(address: string, port: number): string {
  return `${address.includes(":") ? `[${address}]` : address}:${port}`;
}

export function isIpv6(address: string): boolean {
  return address.includes(":");
}

/** Address families present, e.g. "IPv4", "IPv6" or "IPv4 + IPv6" */
export function addressFamilies(port: PortInfo): string {
  const v4 = port.local_addresses.some((a) => !isIpv6(a));
  const v6 = port.local_addresses.some(isIpv6);
  return [v4 && "IPv4", v6 && "IPv6"].filter(Boolean).join(" + ");
}

/** Whether the port is reachable on localhost over HTTP (bound on a wildcard or loopback address) */
export function isLocallyReachable(port: PortInfo): boolean {
  return port.local_addresses.some(
    (a) =>
      a === "0.0.0.0" || a === "::" || a.startsWith("127.") || a === "::1"
  );
}

/** Process name, with the hosted services for svchost.exe and friends */
export function processLabel(port: PortInfo): string {
  return port.services.length > 0
    ? `${port.process_name} · ${port.services.join(", ")}`
    : port.process_name;
}

const WELL_KNOWN_PORTS: Record<number, string> = {
  20: "FTP data",
  21: "FTP",
  22: "SSH",
  23: "Telnet",
  25: "SMTP",
  53: "DNS",
  67: "DHCP",
  68: "DHCP",
  80: "HTTP",
  110: "POP3",
  123: "NTP",
  135: "RPC",
  137: "NetBIOS",
  138: "NetBIOS",
  139: "NetBIOS",
  143: "IMAP",
  161: "SNMP",
  389: "LDAP",
  443: "HTTPS",
  445: "SMB",
  465: "SMTPS",
  587: "SMTP",
  993: "IMAPS",
  995: "POP3S",
  1433: "SQL Server",
  1521: "Oracle",
  1883: "MQTT",
  1900: "SSDP",
  2375: "Docker",
  2376: "Docker TLS",
  3000: "Dev server",
  3306: "MySQL",
  3389: "RDP",
  4200: "Angular",
  5000: "Dev server",
  5173: "Vite",
  5353: "mDNS",
  5355: "LLMNR",
  5432: "PostgreSQL",
  5672: "RabbitMQ",
  5900: "VNC",
  6379: "Redis",
  8000: "HTTP alt",
  8080: "HTTP alt",
  8443: "HTTPS alt",
  9000: "HTTP alt",
  9092: "Kafka",
  9200: "Elasticsearch",
  9229: "Node debug",
  11211: "Memcached",
  15672: "RabbitMQ UI",
  27017: "MongoDB",
};

export function wellKnownPortName(port: number): string | undefined {
  return WELL_KNOWN_PORTS[port];
}
