// A tiny event bus so systems can react to each other (a death raises the wanted level, a shot
// scares pedestrians, a mission listens for a car being wrecked) without importing each other.

export function createEvents() {
  const map = new Map();
  return {
    on(name, fn) {
      if (!map.has(name)) map.set(name, new Set());
      map.get(name).add(fn);
      return () => map.get(name).delete(fn);
    },
    emit(name, ...args) {
      const set = map.get(name);
      if (set) for (const fn of [...set]) fn(...args);
    },
    clear() { map.clear(); },
  };
}
