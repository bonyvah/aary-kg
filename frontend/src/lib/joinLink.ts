/** Where players go to join. Mock value until the real domain is set. */
export const JOIN_HOST = "aary.kg";

export function joinUrl(pin: string): string {
  return `https://${JOIN_HOST}/?pin=${pin}`;
}

/** 123456 -> "123 456", the way the PIN is read out and typed. */
export function formatPin(pin: string): string {
  return pin.length === 6 ? `${pin.slice(0, 3)} ${pin.slice(3)}` : pin;
}
