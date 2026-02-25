export function validatePhone(phone: string): boolean {
  const clean = phone.replace(/\D/g, '');
  return clean.length >= 10 && clean.length <= 15;
}

export function cleanPhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function formatPhone(phone: string): string {
  let clean = cleanPhone(phone);
  if (clean.startsWith('0')) {
    clean = clean.substring(1);
  }
  return clean;
}
