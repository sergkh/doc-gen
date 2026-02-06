
export function splitTeacherName(name: string): { lastName: string, firstName?: string, middleName?: string } {
  const parts = name.split(" ");
  
  if (parts.length < 2) return {lastName: name };

  const lastName = parts[0]!.trim();
  const firstName = parts[1]!.trim();
  const middleName = parts.length > 2 ? parts[2] : undefined;

  return { firstName, lastName, middleName };
}

export function dropDot(text: string): string {
  const trimmed = text.trim();
  if (trimmed.endsWith('.')) {
    return trimmed.substring(0, trimmed.length - 1);
  }
  return trimmed;
}

export function normalizeWhitespaces(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function noQuotes(text: string): string {
  return text.replace(/^[«"']|["'»]$/g, '');
}

export function normalizeApostrophe(text: string): string {
  return text.replace(/[`']/g, "ʼ");
}

export function genericNormalize(text: string): string {
  return normalizeApostrophe(noQuotes(normalizeWhitespaces(dropDot(text))));
}