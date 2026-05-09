
/**
 * Checks if a point (lat, lng) is inside a polygon defined by an array of points.
 * Uses the ray-casting algorithm.
 */
export function isPointInPolygon(latitude: number, longitude: number, polygon: { lat: number, lng: number }[]) {
    if (polygon.length < 3) return false;

    let isInside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].lat, yi = polygon[i].lng;
        const xj = polygon[j].lat, yj = polygon[j].lng;

        const intersect = ((yi > longitude) !== (yj > longitude))
            && (latitude < (xj - xi) * (longitude - yi) / (yj - yi) + xi);
        if (intersect) isInside = !isInside;
    }

    return isInside;
}
