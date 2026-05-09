
/**
 * ============================================================
 *  dateUtils.ts — Timezone-Smart Date Utilities
 * ============================================================
 *  Strategy: The offset is read dynamically from the RESTAURANT
 *  settings stored in localStorage. If not found, falls back to
 *  the browser's own clock (which is correct for any country).
 *
 *  This eliminates ALL hardcoded -4h Bolivia references and makes
 *  the app work correctly in Bolivia, Argentina, Peru, etc.
 * ============================================================
 */

/** 
 * Returns the restaurant's UTC offset in hours.
 * Priority: Stored restaurant timezone > Browser current timezone.
 */
export const getRestaurantOffsetHours = (): number => {
    try {
        const stored = localStorage.getItem('ziroo_restaurant_timezone_offset');
        if (stored !== null) {
            const parsed = parseFloat(stored);
            if (!isNaN(parsed)) return parsed;
        }
    } catch (_) { /* localStorage not available */ }

    // Fallback: use the browser's own timezone offset.
    // getTimezoneOffset() returns minutes WEST of UTC (positive = behind UTC).
    // We negate it to get standard "hours ahead of UTC" convention.
    return -(new Date().getTimezoneOffset() / 60);
};

/**
 * Saves the restaurant's timezone offset to localStorage.
 * Call this when branch settings are loaded.
 * @param offsetHours e.g. -4 for Bolivia (UTC-4)
 */
export const setRestaurantTimezone = (offsetHours: number): void => {
    try {
        localStorage.setItem('ziroo_restaurant_timezone_offset', String(offsetHours));
    } catch (_) { /* ignore */ }
};

/**
 * Returns a Date object representing the current moment in
 * the restaurant's local time (for display purposes only).
 */
export const getRestaurantNow = (date: Date = new Date()): Date => {
    const offsetMs = getRestaurantOffsetHours() * 60 * 60 * 1000;
    return new Date(date.getTime() + offsetMs);
};

/**
 * Returns the ISO string for the START of today in the restaurant's
 * timezone. Used as the `gte` filter for Supabase queries.
 *
 * Example: If restaurant is UTC-4 and local date is 2026-04-10,
 *          start of day in UTC is "2026-04-10T04:00:00.000Z"
 */
export const getLocalDayStart = (): string => {
    const now = new Date();
    const offsetHours = getRestaurantOffsetHours();
    const offsetMs = offsetHours * 60 * 60 * 1000;

    // Shift UTC time to local restaurant time to determine the local date
    const localNow = new Date(now.getTime() + offsetMs);
    const year = localNow.getUTCFullYear();
    const month = String(localNow.getUTCMonth() + 1).padStart(2, '0');
    const day = String(localNow.getUTCDate()).padStart(2, '0');

    // Start of that local day in UTC: subtract the offset back
    const startOfDayUTC = -offsetHours;
    const startHour = String(Math.floor(startOfDayUTC)).padStart(2, '0');
    const startMin = String(Math.abs((startOfDayUTC % 1) * 60)).padStart(2, '0');

    return `${year}-${month}-${day}T${startHour}:${startMin}:00.000Z`;
};

/**
 * Checks if a given date falls on "today" in the restaurant's timezone.
 */
export const isToday = (someDate: Date | string | number | undefined): boolean => {
    if (!someDate) return false;
    const date = new Date(someDate);
    if (isNaN(date.getTime())) return false;

    const offsetMs = getRestaurantOffsetHours() * 60 * 60 * 1000;
    const localNow = new Date(Date.now() + offsetMs);
    const localDate = new Date(date.getTime() + offsetMs);

    return localNow.getUTCFullYear() === localDate.getUTCFullYear() &&
           localNow.getUTCMonth() === localDate.getUTCMonth() &&
           localNow.getUTCDate() === localDate.getUTCDate();
};

/**
 * Checks if a given date falls on "yesterday" in the restaurant's timezone.
 */
export const isYesterday = (someDate: Date | string | number | undefined): boolean => {
    if (!someDate) return false;
    const date = new Date(someDate);
    if (isNaN(date.getTime())) return false;

    const offsetMs = getRestaurantOffsetHours() * 60 * 60 * 1000;
    const localNow = new Date(Date.now() + offsetMs);
    const localYesterday = new Date(localNow.getTime() - 24 * 3600000);
    const localDate = new Date(date.getTime() + offsetMs);

    return localYesterday.getUTCFullYear() === localDate.getUTCFullYear() &&
           localYesterday.getUTCMonth() === localDate.getUTCMonth() &&
           localYesterday.getUTCDate() === localDate.getUTCDate();
};

// ============================================================
// LEGACY COMPATIBILITY ALIASES (keep old names working)
// These let DailySales.tsx and other existing files continue
// to import `isTodayBolivia` without any changes to their imports.
// ============================================================
export const isTodayBolivia = isToday;
export const isYesterdayBolivia = isYesterday;
export const getBoliviaTodayStart = getLocalDayStart;
export const getBoliviaTime = getRestaurantNow;
