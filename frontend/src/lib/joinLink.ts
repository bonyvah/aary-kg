/** The address players are told to visit. Mock value until the real domain is set. */
export const JOIN_HOST = "aary.kg";

/** The link in the QR code. Pass the origin the host screen is on, so the code opens the same site. */
export function joinUrl(pin: string, origin: string = `https://${JOIN_HOST}`): string {
  return `${origin}/?pin=${pin}`;
}

/** 123456 -> "123 456", the way the PIN is read out and typed. */
export function formatPin(pin: string): string {
  return pin.length === 6 ? `${pin.slice(0, 3)} ${pin.slice(3)}` : pin;
}
