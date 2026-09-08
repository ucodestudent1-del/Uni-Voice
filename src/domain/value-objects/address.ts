export interface Address {
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  stateOrRegion: string;
  postalCode: string;
  countryCode: string;
  taxId?: string | null;
}

export function formatAddress(a: Address, separator: string = "\n"): string {
  const lines: string[] = [a.addressLine1];
  if (a.addressLine2) lines.push(a.addressLine2);
  let cityLine = a.city;
  if (a.stateOrRegion) cityLine += `, ${a.stateOrRegion}`;
  if (a.postalCode) cityLine += ` ${a.postalCode}`;
  lines.push(cityLine);
  lines.push(a.countryCode);
  if (a.taxId) lines.push(`Tax ID: ${a.taxId}`);
  return lines.filter(Boolean).join(separator);
}
