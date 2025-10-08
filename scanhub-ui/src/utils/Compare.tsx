function getAllKeys(obj: any, prefix = ''): string[] {
  return Object.keys(obj).flatMap((key) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      return getAllKeys(obj[key], path);
    }
    return path;
  });
}

export function haveSameKeys(obj1: any, obj2: any): boolean {
  const keys1 = getAllKeys(obj1).sort();
  const keys2 = getAllKeys(obj2).sort();
  return JSON.stringify(keys1) === JSON.stringify(keys2);
}