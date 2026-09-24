export function skillList(skills: string | null | undefined): string[] {
  return (skills ?? '')
    .split(',')
    .map((skill) => skill.trim())
    .filter(Boolean);
}
