const GOOGLE_PLACES_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");
const MAPBOX_TOKEN = Deno.env.get("MAPBOX_TOKEN");

export interface GeoResult {
  lat: number;
  lng: number;
  formatted?: string;
  provider: string;
}

const BAD_COORDS: Array<{ lat: number; lng: number; label: string }> = [
  { lat: 41.8781, lng: -87.6298, label: "chicago_default_fallback" },
  { lat: 41.8755616, lng: -87.6244212, label: "nominatim_chicago_centroid" },
  { lat: 41.887063, lng: -87.62925, label: "mapbox_chicago_city_point" },
];
const BAD_RADIUS_DEG = 0.0015;

const UNIT_TOKEN_RE =
  /,?\s*(?:suite|ste\.?|unit|apt\.?|#|fl(?:oor)?|rm|room)\s*[\w-]+/gi;

let mapboxFirstCall = true;

// --- Guard ---

export function isBadCoordinate(lat: number, lng: number): boolean {
  return BAD_COORDS.some(
    (b) =>
      Math.abs(lat - b.lat) < BAD_RADIUS_DEG &&
      Math.abs(lng - b.lng) < BAD_RADIUS_DEG,
  );
}

export function isPlausibleStreetAddress(s: string | null | undefined): boolean {
  if (!s) return false;
  const t = s.trim();
  if (/^unknown/i.test(t)) return false;
  return /^\d{1,6}\s+\S/.test(t);
}

// --- Provider chain ---

export async function resolveCoordinates(
  address: string,
  city = "Chicago",
): Promise<GeoResult | null> {
  const attempts: Array<() => Promise<GeoResult | null>> = [];
  if (GOOGLE_PLACES_API_KEY) attempts.push(() => geocodeGoogle(address));
  if (MAPBOX_TOKEN) attempts.push(() => geocodeMapbox(address, city));
  attempts.push(() => geocodeNominatimHardened(address, city));

  for (const attempt of attempts) {
    const r = await attempt();
    if (r && !isBadCoordinate(r.lat, r.lng)) return r;
  }
  return null;
}

// --- Business-name search chain (NEVER Nominatim by name) ---

export async function geocodeBusinessByName(
  name: string,
  city: string,
  state = "IL",
): Promise<(GeoResult & { address: string | null }) | null> {
  if (GOOGLE_PLACES_API_KEY) {
    const g = await placesTextSearch(name, city, state);
    if (g && !isBadCoordinate(g.lat, g.lng)) return g;
  }
  if (MAPBOX_TOKEN) {
    const m = await geocodeMapboxPoi(`${name} ${city} ${state}`);
    if (m && !isBadCoordinate(m.lat, m.lng)) {
      if (nameOverlap(name, m.formatted ?? "") >= 0.5) {
        return { ...m, address: m.formatted ?? null };
      }
    }
  }
  return null;
}

// --- Mapbox forward geocoding ---

async function geocodeMapbox(
  query: string,
  city: string,
): Promise<GeoResult | null> {
  if (!MAPBOX_TOKEN) return null;
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
  );
  url.searchParams.set("access_token", MAPBOX_TOKEN);
  url.searchParams.set("limit", "1");
  url.searchParams.set("country", "us");
  url.searchParams.set("proximity", "-87.6298,41.8781");
  url.searchParams.set("types", "address,poi");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);

    if (mapboxFirstCall) {
      mapboxFirstCall = false;
      if (res.ok) {
        console.log(`[geocoder] Mapbox first call: ${res.status} OK`);
      } else {
        console.warn(
          `[geocoder] Mapbox token rejected: ${res.status} — URL-restricted? Falling through to Nominatim`,
        );
      }
    }

    if (!res.ok) return null;
    const data = await res.json();
    const f = data.features?.[0];
    if (!f?.center) return null;

    const placeType: string[] = f.place_type ?? [];
    if (
      placeType.some((t: string) =>
        ["place", "region", "district", "locality", "postcode"].includes(t),
      )
    ) {
      return null;
    }
    return {
      lat: f.center[1],
      lng: f.center[0],
      formatted: f.place_name,
      provider: "mapbox",
    };
  } catch {
    return null;
  }
}

async function geocodeMapboxPoi(query: string): Promise<GeoResult | null> {
  if (!MAPBOX_TOKEN) return null;
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
  );
  url.searchParams.set("access_token", MAPBOX_TOKEN);
  url.searchParams.set("limit", "1");
  url.searchParams.set("country", "us");
  url.searchParams.set("proximity", "-87.6298,41.8781");
  url.searchParams.set("types", "poi");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    const f = data.features?.[0];
    if (!f?.center) return null;
    return {
      lat: f.center[1],
      lng: f.center[0],
      formatted: f.place_name,
      provider: "mapbox_poi",
    };
  } catch {
    return null;
  }
}

// --- Hardened Nominatim (B1 structural fix + B4 suite-strip) ---

async function geocodeNominatimHardened(
  address: string,
  city: string,
): Promise<GeoResult | null> {
  const query = address
    .replace(UNIT_TOKEN_RE, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "us");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "AOA-ClassFinder/1.0 (contact: deric.o.ortiz@gmail.com)",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const data = await res.json();
    const hit = Array.isArray(data) ? data[0] : null;
    if (!hit) return null;

    const at = (hit.addresstype ?? hit.type ?? "").toLowerCase();
    const cls = (hit.class ?? "").toLowerCase();
    if (
      cls === "boundary" ||
      [
        "city",
        "town",
        "administrative",
        "state",
        "county",
        "suburb",
        "neighbourhood",
        "postcode",
      ].includes(at)
    ) {
      return null;
    }
    return {
      lat: parseFloat(hit.lat),
      lng: parseFloat(hit.lon),
      formatted: hit.display_name,
      provider: "nominatim",
    };
  } catch {
    return null;
  }
}

// --- Google geocoding ---

async function geocodeGoogle(
  address: string,
): Promise<GeoResult | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", GOOGLE_PLACES_API_KEY!);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const data = await res.json();
    if (data.status !== "OK" || !data.results?.length) return null;
    const loc = data.results[0].geometry.location;
    return {
      lat: loc.lat,
      lng: loc.lng,
      formatted: data.results[0].formatted_address,
      provider: "google",
    };
  } catch {
    return null;
  }
}

// --- Google Places text search ---

async function placesTextSearch(
  name: string,
  city: string,
  state: string,
): Promise<(GeoResult & { address: string | null }) | null> {
  if (!GOOGLE_PLACES_API_KEY) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
          "X-Goog-FieldMask":
            "places.displayName,places.formattedAddress,places.location",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ textQuery: `${name}, ${city}, ${state}` }),
        signal: controller.signal,
      },
    );
    clearTimeout(timeout);
    if (!res.ok) return null;

    const data = await res.json();
    const place = data.places?.[0];
    if (!place?.location || !place?.displayName?.text) return null;

    if (nameOverlap(name, place.displayName.text) < 0.5) return null;

    return {
      lat: place.location.latitude,
      lng: place.location.longitude,
      formatted: place.formattedAddress,
      address: place.formattedAddress ?? null,
      provider: "google_places",
    };
  } catch {
    return null;
  }
}

// --- Helpers ---

function nameOverlap(name: string, candidate: string): number {
  const nameTokens = name
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1);
  if (nameTokens.length === 0) return 0;
  const candidateTokens = candidate
    .toLowerCase()
    .split(/\s+/)
    .filter((t: string) => t.length > 1);
  const overlap = nameTokens.filter((t: string) =>
    candidateTokens.includes(t),
  ).length;
  return overlap / nameTokens.length;
}

// --- Legacy wrappers (backward compat for callers not yet updated) ---

export async function geocode(
  address: string,
): Promise<{ lat: number; lng: number; source: string } | null> {
  const r = await resolveCoordinates(address);
  if (!r) return null;
  return { lat: r.lat, lng: r.lng, source: r.provider };
}

export async function geocodeByBusinessName(
  name: string,
  city: string,
  state = "IL",
): Promise<{
  lat: number;
  lng: number;
  address: string;
  source: string;
} | null> {
  const r = await geocodeBusinessByName(name, city, state);
  if (!r) return null;
  return {
    lat: r.lat,
    lng: r.lng,
    address: r.address ?? "",
    source: r.provider,
  };
}
