export function isValidPhoneNumber(value: string) {
  return /^[0-9]{9,10}$/.test(value.trim());
}