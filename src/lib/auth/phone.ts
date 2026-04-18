export function toDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatPhoneNumber(value: string): string {
  const digits = toDigits(value).slice(0, 11);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

export function toE164KoreanPhone(value: string): string | null {
  const digits = toDigits(value);

  if (!/^01\d{8,9}$/.test(digits)) {
    return null;
  }

  const withoutLeadingZero = digits.startsWith("0") ? digits.slice(1) : digits;
  return `+82${withoutLeadingZero}`;
}
