declare module "pkcs7-padding" {
  export function pad(data: Uint8Array, size?: number): Uint8Array;
  export function pad(data: string, size?: number): string;
  export function unpad(data: Uint8Array): Uint8Array;
  export function unpad(data: string): string;
}
