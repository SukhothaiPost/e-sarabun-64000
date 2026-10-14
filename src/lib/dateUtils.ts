export function formatToBuddhistEra(date: Date | null | undefined): string {
  if (!date) return '-';
  
  const formatter = new Intl.DateTimeFormat('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  
  return formatter.format(date);
}

export function formatToBuddhistEraWithTime(date: Date | null | undefined): string {
  if (!date) return '-';
  
  const formatter = new Intl.DateTimeFormat('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  
  return formatter.format(date);
}
