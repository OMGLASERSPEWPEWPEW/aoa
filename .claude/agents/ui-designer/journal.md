# Evolution Journal

*This journal grows through /evolution sessions. Each entry captures learnings, domain research, and commitments.*

---

## 2026-08-16 -- Dual-Mode Map Interfaces and the Art of Content Layering

### Context

The Art of Art now ships a dual-mode map: SHOWS (theater productions on the map) and CLASSES (acting schools with session data). This required a full component suite -- MapModeControl (segmented toggle), ClassMarker (discipline-coded circular markers with glyphs), ClassSheet (bottom sheet with session details, teachers, nearby schools), ClassDiscoveryDashboard (admin scrape progress with arc + pipeline dots), and LevelPips (skill level visualization). Reviewing these components against current industry patterns reveals both strengths and areas to sharpen.

### Research Findings

**Segmented controls in map contexts.** Best practice limits segments to 2-5 options. Our MapModeControl has exactly two (SHOWS / CLASSES), which is optimal. The research from Eleken and design system blueprints emphasizes that the active state must be visually unambiguous within 150ms of tap -- users will double-tap if they cannot tell immediately that the mode switched. Our current implementation uses a hard background color swap with no sliding pill animation. This works, but a sliding pill transition would add polish: the active indicator physically moves from one segment to the other, reinforcing the spatial metaphor of "switching views." Framer Motion or a simple CSS transform on a pseudo-element behind the active button would accomplish this without complexity. The count badges beside each label (e.g., "SHOWS 42") are a strong pattern -- they answer "is this mode worth switching to?" before the user commits.

**Marker differentiation across layers.** The INVOLI air traffic and Google Maps transit overlay patterns use color coding plus shape differentiation as dual signals. Our implementation follows this: show markers use one shape vocabulary while ClassMarker uses circular rings with discipline glyphs (improv gets a different glyph than acting, etc.). The oklch color system for disciplines is well-chosen -- perceptually uniform lightness means no discipline "pops" more than another at a glance, which prevents false hierarchy. One risk: at dense zoom levels, the 38px marker with 8px label could crowd. Smart clustering at lower zoom levels (collapsing nearby school markers into a count bubble) would prevent the visual clutter that map UX research consistently flags as users' primary frustration.

**Bottom sheets as detail surfaces.** Apple Maps normalized the pull-up bottom sheet for detail views, and our ClassSheet follows this convention faithfully: grab handle, drag-to-dismiss with velocity threshold, backdrop tap to close, spring-mounted entry animation. The 80px drag threshold for dismissal is generous. The "ALSO NEARBY" section that cross-links to other schools is a strong discovery pattern -- it keeps users in the exploration flow rather than forcing them back to the map to find the next option. The photo placeholder ("THE ROOM") is honest scaffolding; when real photos arrive, a 16:9 or 4:3 ratio hero image will dramatically increase engagement with the sheet.

**Discovery dashboards as operational UI.** The ClassDiscoveryDashboard is admin-facing, but its design language (progress arc, pipeline dots with pulse animation, activity log) sets a standard. The half-arc SVG gauge with serif counter centered inside it is a pattern borrowed from automotive dashboards and fitness apps -- it communicates progress without requiring the user to read numbers. The amber color system differentiates admin operations from the user-facing purple/blue accent palette, which is critical: users should never confuse operational UI with product UI.

### Commitments

1. **Add sliding pill to MapModeControl.** A 200ms ease-out translateX on a pseudo-element behind the active segment. Low effort, high perceived quality.
2. **Implement marker clustering at zoom < 12.** Collapse class markers within 50px of each other into a count bubble. Prevents map clutter as school data grows.
3. **Prepare ClassSheet for hero images.** Define the aspect ratio container now (88px tall placeholder to 160px 16:9 hero), so swapping in real photos is a one-line change.
4. **Audit touch targets.** The 8px label text on ClassMarker and the tag chips in ClassSheet are visually small. Ensure their tap target areas meet the 44x44 minimum even if the visual element is smaller.
5. **Consider an "ALL" mode.** As the map accrues more content types (venues, classes, and eventually events/festivals), a third "ALL" segment that shows everything with distinct marker shapes would test the scalability of the segmented control pattern. Research says 3 segments is still comfortable; beyond that, a filter sheet is better.
