# Evolution Journal

*This journal grows through /evolution sessions. Each entry captures learnings, domain research, and commitments.*

---

## 2026-08-16 -- How Newcomers Choose Their First Art Class: Research Synthesis for the Classes Feature

### Context

Art classes launched as a second content domain alongside shows. The dual-mode map lets users toggle between SHOWS and CLASSES views, and ClassSheet surfaces details like instructor, level, format, sessions, and price. The catalog grows automatically via SerpAPI discovery. Our core user is a Chicago theater newcomer -- someone in Acting 2 or considering their first class -- so understanding how beginners navigate this decision is critical.

### Key Findings from Domain Research

**1. Beginner anxiety is the dominant barrier, not information scarcity.**

Research on theater newcomers consistently shows that the primary obstacle is social and performance anxiety, not a lack of available classes. Beginners worry they "don't belong" because everyone else seems to know each other. They fear being underprepared even if they have some experience. This is not a search problem -- it is an emotional safety problem. The implication for our ClassSheet is that surfacing "beginner-friendly" signals (explicit level labels, class size, whether prior experience is required) matters more than listing every available option. A class tagged "No Experience Needed" with a small class size actively reduces the perceived risk of showing up.

**2. Decision paralysis is real when the catalog grows.**

Nielsen Norman Group and broader UX research on the paradox of choice confirm that when users face too many options without guidance, they often make no choice at all. Hick's Law applies directly: as our SerpAPI backfill populates dozens or hundreds of classes, unfiltered listings will degrade conversion. The antidote is progressive disclosure and curated entry points. Rather than dumping the full catalog, we should surface "Recommended for You" or "Great First Classes" as a default view, with full browse available one tap deeper. Adaptive learning platforms that use recommender systems to reduce content overload show meaningfully better engagement than raw listings.

**3. The five decision factors for adult class selection, ranked by newcomer priority.**

Research on adult education class selection surfaces five consistent factors: (a) instructor quality and reputation, (b) schedule fit, (c) location/proximity, (d) price, and (e) peer reviews or social proof. For newcomers specifically, instructor reputation and social proof outweigh price -- beginners are willing to pay more for a class that feels safe and well-reviewed. Our ClassSheet currently shows instructor, price, format, and sessions. It does not yet surface reviews or social proof. Adding even a simple "X people from your area took this" or community endorsement signal would address the trust gap.

**4. Discovery channels: word-of-mouth dominates, but aggregation wins for exploration.**

The Chicago theater class landscape is fragmented across individual school websites (Second City, Old Town School, Acting Studio Chicago, etc.). Platforms like CourseHorse aggregate listings, but lack community context. Adults primarily discover classes through word-of-mouth from friends or fellow students. Our app is uniquely positioned to combine aggregation (SerpAPI discovery) with community signal (reviews, watchlist counts, friend activity). The map-centric view adds a spatial dimension that no current aggregator offers for Chicago arts classes.

### Implications for the Art of Art

- **ClassSheet should foreground emotional safety signals**: explicit beginner labels, class size, "no experience needed" tags, and eventually community reviews.
- **Default class views should be curated, not exhaustive**: "Great for Beginners," "Near You," or mentor-recommended classes should be the landing state.
- **Social proof is the missing layer**: even simple signals like watchlist counts or "a friend took this" would reduce newcomer anxiety and drive enrollment confidence.
- **The map view is a genuine differentiator**: no existing Chicago arts class discovery tool combines geographic browsing with community context.

### Commitments

- Advocate for a "beginner-friendly" filter or badge as the highest-priority ClassSheet enhancement.
- Push for social proof signals (watchlist count, community endorsement) in the next iteration.
- Design a 5-user guerrilla study protocol to validate which ClassSheet fields newcomers actually look at versus ignore.
- Monitor whether the dual-mode toggle (SHOWS vs CLASSES) creates confusion or feels natural -- this is a testable hypothesis for a quick unmoderated study.

### Sources

- NN/G on choice overload: https://www.nngroup.com/videos/choice-overload/
- UserTesting on paradox of choice in UX: https://www.usertesting.com/blog/how-to-use-the-paradox-of-choice-in-ux-design
- Psychology Today on acting classes and social anxiety: https://www.psychologytoday.com/us/blog/when-kids-call-the-shots/201905/social-anxiety-acting-class-can-help
- Training Industry on managing learning content overload: https://trainingindustry.com/magazine/summer-2023/the-paradox-of-choice-how-to-manage-learning-content-overload/
- Lenhoff et al. (2026) on choice architecture and anxiety in school choice: https://journals.sagepub.com/doi/10.1177/08959048251408834
- OnStage Blog on running beginner acting classes: https://www.onstageblog.com/editorials/2024/5/8/how-to-start-a-beginners-actor-class

