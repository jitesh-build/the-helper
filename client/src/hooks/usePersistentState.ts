// import { useEffect, useState } from 'react';
// import type { Dispatch, SetStateAction } from 'react';

// export function usePersistentState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
//   const [value, setValue] = useState<T>(() => {
//     try {
//       const raw = localStorage.getItem(key);
//       return raw === null ? initial : (JSON.parse(raw) as T);
//     } catch {
//       return initial;
//     }
//   });
//   useEffect(() => {
//     try {
//       localStorage.setItem(key, JSON.stringify(value));
//     } catch {
//       /* storage full or blocked: the plan just won't persist */
//     }
//   }, [key, value]);
//   return [value, setValue];
// }