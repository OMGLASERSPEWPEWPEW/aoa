# Evolution Journal

*This journal grows through /evolution sessions. Each entry captures learnings, domain research, and commitments.*

---

## 2026-08-16 | Web Scraping, Data Aggregation, and Privacy Compliance Audit

### Context

The Art of Art now operates multiple automated scraping pipelines: venue discovery (ChicagoPlays directory parsing), event scraping (theater website HTML extraction), art class discovery (SerpAPI Google search plus direct website fetching), and AI-powered data enrichment (DeepSeek extracting structured fields from raw HTML). These pipelines collect venue names, addresses, class schedules, pricing, and -- critically -- instructor names, which constitute personal data under both GDPR and CCPA.

### Web Scraping Legal Posture

The current implementation gets several things right. The bot identifies itself honestly with a `User-Agent` header (`ArtOfArt-EventBot/1.0` with a contact URL), and it scrapes only publicly accessible pages without bypassing login walls or authentication. Under the hiQ v. LinkedIn line of cases, scraping publicly visible data generally does not constitute unauthorized access under the Computer Fraud and Abuse Act (CFAA). The 500ms delay between SerpAPI queries shows rate-limiting awareness.

However, several risks remain unaddressed. First, no part of the scraping pipeline checks robots.txt files before fetching. While robots.txt is advisory and not legally binding in the US, ignoring it undermines the "good faith" argument that courts consider in CFAA and trespass-to-chattels claims. Second, none of the target school or theater websites have been audited for Terms of Service that prohibit scraping. The Meta v. Bright Data ruling confirmed that breach-of-contract claims based on ToS can survive even when CFAA claims fail. Third, using SerpAPI to query Google is governed by SerpAPI's own terms, not Google's, but the downstream act of visiting each result URL and extracting content is a separate legal event that needs its own compliance posture.

### Personal Data: Instructor Names

The class-discovery pipeline scrapes instructor names from school websites and stores them in the database. Under GDPR (if any EU-based instructors teach in Chicago or if any EU users access the app) and under Illinois BIPA/consumer protection law, names tied to professional activity are personal data. The current approach has no documented lawful basis for processing. A Legitimate Interest Assessment (LIA) should be drafted that documents: (1) the legitimate interest (helping users find relevant classes), (2) necessity (instructor identity is a meaningful differentiator for class selection), (3) balancing (instructors publicly list their names on school websites, so reasonable expectation of further dissemination exists), and (4) safeguards (no sensitive data collected, opt-out mechanism available).

### Pricing Data Aggregation

Aggregating and displaying third-party pricing carries two distinct risks. Copyright risk is low because factual data (prices, schedules) is not copyrightable under Feist v. Rural Telephone. However, displaying stale or incorrect pricing could create consumer protection liability if users rely on it for purchasing decisions. The weekly cron refresh cadence mitigates staleness, but a visible "prices last verified" timestamp and a disclaimer ("verify pricing directly with the school") should be added to every class listing.

### Recommended Actions

1. **Add robots.txt checking** to all scraper pipelines before fetching any URL. Log and skip URLs where robots.txt disallows the bot's User-Agent.
2. **Draft a Terms of Service and Privacy Policy** for the app itself, disclosing the data collected from users and from third-party websites. This is a prerequisite before any public launch.
3. **Implement an instructor opt-out mechanism** -- a simple email-based process where an instructor can request removal of their name from the platform.
4. **Add pricing disclaimers** to class listing UI: "Pricing sourced from school websites. Verify directly before enrolling."
5. **Audit target website ToS** for the top 10 most-scraped domains. Document findings. If any explicitly prohibit scraping, either obtain permission or exclude that source.
6. **Draft a Legitimate Interest Assessment** for instructor name collection, following the EDPB Guidelines 03/2026 framework.

### Commitments

I will prepare a draft Privacy Policy and Terms of Service skeleton in a future evolution session, tailored to the app's current data flows. I will also produce a robots.txt compliance checklist that can be integrated into the scraper shared utilities.

---
