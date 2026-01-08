
export function splitTeacherName(name: string): { lastName: string, firstName?: string, middleName?: string } {
  const parts = name.split(" ");
  
  if (parts.length < 2) return {lastName: name };

  const lastName = parts[0]!.trim();
  const firstName = parts[1]!.trim();
  const middleName = parts.length > 2 ? parts[2] : undefined;

  return { firstName, lastName, middleName };
}