const GOOGLE_PLACES_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");

export async function geocode(
  address: string,
): Promise<{ lat: number; lng: number; source: string } | null> {
  if (GOOGLE_PLACES_API_KEY) {
    return geocodeGoogle(address);
  }
  return geocodeNominatim(address);
}

export async function geocodeByBusinessName(
  name: string,
  city: string,
  state = "IL",
): Promise<{ lat: number; lng: number; address: string; source: string } | null> {
  if (!GOOGLE_PLACES_API_KEY) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ textQuery: `${name}, ${city}, ${state}` }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    const place = data.places?.[0];
    if (!place?.location || !place?.displayName?.text) return null;

    const nameTokens = name.toLowerCase().split(/\s+/).filter(t => t.length > 1);
    const displayTokens = place.displayName.text.toLowerCase().split(/\s+/).filter((t: string) => t.length > 1);
    const overlap = nameTokens.filter((t: string) => displayTokens.includes(t)).length;
    if (nameTokens.length > 0 && overlap / nameTokens.length < 0.5) return null;

    return {
      lat: place.location.latitude,
      lng: place.location.longitude,
      address: place.formattedAddress ?? "",
      source: "places_api",
    };
  } catch {
    return null;
  }
}

async function geocodeNominatim(
  address: string,
): Promise<{ lat: number; lng: number; source: string } | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", address);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "us");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "ArtOfArt-EventBot/1.0 (contact: deric.o.ortiz@gmail.com)" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      source: "nominatim",
    };
  } catch {
    return null;
  }
}

async function geocodeGoogle(
  address: string,
): Promise<{ lat: number; lng: number; source: string } | null> {
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
    return { lat: loc.lat, lng: loc.lng, source: "google_places" };
  } catch {
    return null;
  }
}
