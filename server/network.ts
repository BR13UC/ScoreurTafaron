import os from 'node:os';

export interface NetworkAddress { address: string; label: string; }

export function getPrivateNetworkAddresses(): NetworkAddress[] {
  const addresses: NetworkAddress[] = [];
  for (const [label, entries] of Object.entries(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) continue;
      const privateIp = entry.address.startsWith('10.') || entry.address.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[01])\./.test(entry.address);
      if (privateIp) addresses.push({ address: entry.address, label });
    }
  }
  return addresses;
}
