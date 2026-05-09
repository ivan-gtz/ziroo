
import { useState, useEffect, Dispatch, SetStateAction, useCallback, useRef } from 'react';

/**
 * A custom hook that persists state in localStorage and is resilient to data structure changes.
 * @param key The key to use in localStorage.
 * @param initialValue The initial value to use if none is found in storage.
 * @returns A stateful value, and a function to update it.
 */
function useLocalStorage<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  // Use a ref to store the initial value to avoid re-running effect if a new object literal is passed
  const initialValueRef = useRef(initialValue);

  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValueRef.current;
    }
    try {
      const item = window.localStorage.getItem(key);
      if (!item) {
        return initialValueRef.current;
      }
      
      const stored = JSON.parse(item);

      // CRITICAL FIX: Strict type checking to prevent Array/Object confusion
      
      // 1. Handle Arrays
      if (Array.isArray(initialValueRef.current)) {
         if (!Array.isArray(stored)) {
             console.warn(`localStorage key "${key}" expected Array but found ${typeof stored}. Resetting to initial.`);
             return initialValueRef.current;
         }
         return stored;
      }

      // 2. Handle Objects (non-null, non-array)
      if (typeof initialValueRef.current === 'object' && initialValueRef.current !== null) {
          if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) {
              console.warn(`localStorage key "${key}" expected Object but found something else. Resetting to initial.`);
              return initialValueRef.current;
          }
          // Merge objects to allow for new fields in updates
          return { ...initialValueRef.current, ...stored };
      }

      return stored;
    } catch (error) {
      console.error(`Failed to parse localStorage key "${key}", falling back to initial value.`, error);
      return initialValueRef.current;
    }
  });

  const setValue = useCallback((value: SetStateAction<T>) => {
    try {
      setStoredValue((prev) => {
        const valueToStore = value instanceof Function ? value(prev) : value;
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
        return valueToStore;
      });
    } catch (error) {
      console.error("Failed to save to localStorage:", error);
    }
  }, [key]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key) {
        try {
          setStoredValue(e.newValue ? JSON.parse(e.newValue) : initialValueRef.current);
        } catch (error) {
          setStoredValue(initialValueRef.current);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key]); 

  return [storedValue, setValue];
}

export default useLocalStorage;
