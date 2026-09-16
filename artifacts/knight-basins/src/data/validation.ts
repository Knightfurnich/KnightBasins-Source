export function isValidPhoneNumber(value: string) {
  return /^[0-9]{9,10}$/.test(value.trim());
}

export function isValidEmailAddress(value: string) {
  const email = value.trim();
  return email === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}