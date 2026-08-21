import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { filterWritable } from "./overrides.ts";

Deno.test("filterWritable splits fields by held set", () => {
  const held = new Set(["name", "venue_type", "photo_url"]);
  const extracted = {
    name: "New Name",
    venue_type: "institutional",
    photo_url: "https://example.com/photo.jpg",
    calendar_url: "https://example.com/events",
    description: "Updated description",
  };

  const { writable, blocked } = filterWritable(extracted, held);

  assertEquals(Object.keys(writable).sort(), ["calendar_url", "description"]);
  assertEquals(Object.keys(blocked).sort(), ["name", "photo_url", "venue_type"]);
  assertEquals(writable.calendar_url, "https://example.com/events");
  assertEquals(blocked.name, "New Name");
});

Deno.test("filterWritable returns all writable when no fields held", () => {
  const held = new Set<string>();
  const extracted = { name: "Test", venue_type: "school" };
  const { writable, blocked } = filterWritable(extracted, held);

  assertEquals(Object.keys(writable).sort(), ["name", "venue_type"]);
  assertEquals(Object.keys(blocked), []);
});

Deno.test("filterWritable returns all blocked when every field is held", () => {
  const held = new Set(["name", "venue_type"]);
  const extracted = { name: "Test", venue_type: "school" };
  const { writable, blocked } = filterWritable(extracted, held);

  assertEquals(Object.keys(writable), []);
  assertEquals(Object.keys(blocked).sort(), ["name", "venue_type"]);
});

Deno.test("filterWritable handles empty extraction", () => {
  const held = new Set(["name"]);
  const extracted = {};
  const { writable, blocked } = filterWritable(extracted, held);

  assertEquals(Object.keys(writable), []);
  assertEquals(Object.keys(blocked), []);
});
