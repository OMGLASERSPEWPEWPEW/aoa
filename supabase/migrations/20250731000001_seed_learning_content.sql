-- Seed: Learning content for belt progression
-- Categories: venue, playwright, genre, guide, history

INSERT INTO learning_content (id, slug, title, body, category, belt_requirement) VALUES
  -- White Belt (0) - Absolute basics
  (gen_random_uuid(), 'what-is-storefront', 'What Is Storefront Theater?',
   'Chicago invented storefront theater. It''s exactly what it sounds like — theater in a converted storefront, usually under 100 seats. The intimacy is the point. You''re close enough to see the actors sweat, and the ticket price is usually under $30.

Storefront doesn''t mean amateur. Some of the most exciting, boundary-pushing work in American theater happens in these tiny spaces. Companies like Steep Theatre, A Red Orchid, and Profiles have built national reputations from rooms the size of your apartment.

The magic of storefront: there''s nowhere to hide. No fancy sets, no orchestra pit. Just actors and story, six feet from your face.',
   'guide', 0),

  (gen_random_uuid(), 'chicago-theater-101', 'Chicago Theater: A 2-Minute History',
   'Chicago has more theaters than any city except London and New York. But what makes it different is the culture.

In the 1970s, a group of Northwestern students (including Gary Sinise and John Malkovich) started rehearsing in a church basement. They called themselves Steppenwolf. They couldn''t afford sets, so they focused on acting. The raw, unflinching style they developed became the "Chicago School" — ensemble-driven, emotionally honest, allergic to pretension.

That spirit spread. By the 1980s, storefront theaters were popping up everywhere. Second City was training comedy legends. The Neo-Futurists were inventing new forms. Today, Chicago has over 200 theater companies, and the storefront ethos — scrappy, bold, accessible — runs through all of them.',
   'history', 0),

  (gen_random_uuid(), 'how-to-buy-tickets', 'How to Score Cheap Tickets',
   'Theater in Chicago is more affordable than you think.

**HotTix**: Chicago''s official half-price ticket outlet. Day-of tickets at 50% off. Check hottix.org daily — availability changes constantly. Best for institutional theaters.

**Pay-what-you-can**: Many storefront theaters offer at least one performance per run where you pay what you can afford. No judgment, no questions.

**Industry nights**: Usually Mondays or Tuesdays. Deeply discounted for anyone who works in hospitality, arts, or service. Bring a pay stub.

**Rush tickets**: Some theaters offer cheap tickets to the first people in line before a show. Steppenwolf''s are $20.

**Free previews**: The first few performances of a run are often free or deeply discounted. The show is still finding itself, but that''s part of the fun.',
   'guide', 0),

  (gen_random_uuid(), 'theater-etiquette', 'What to Expect at Your First Show',
   'Nervous about your first show? Don''t be. Here''s the deal:

**Dress code**: There isn''t one. Seriously. Jeans are fine everywhere. The only exception is opening night galas, and even then, "nice jeans" works.

**When to arrive**: 15 minutes early. Storefront theaters seat right at curtain — if you''re late, you might not get in until intermission.

**Phone**: Off. Not vibrate. Off. In a 50-seat theater, everyone can hear your phone buzz.

**When to clap**: After scenes if you want, definitely at the end. Standing ovations are earned, not automatic.

**Talking**: Never during the show. In immersive/interactive shows, talk when invited.

**Leaving**: If you hate it, wait for intermission. Walking out during a scene in a storefront theater is... very visible.',
   'guide', 0),

  -- Yellow Belt (1) - Know the landscape
  (gen_random_uuid(), 'neighborhoods-theater', 'Theater Neighborhoods You Should Know',
   '**Lincoln Park / Old Town**: The establishment. Steppenwolf, Second City, iO. Bigger venues, higher prices, easier to find parking.

**Lakeview / Boystown**: Comedy hub. The Annoyance, lots of late-night shows. The neighborhood is lively and walkable.

**Andersonville / Edgewater**: The indie zone. Neo-Futurists, Steep Theatre. Smaller audiences, bigger risks, incredible energy.

**Wicker Park / Bucktown**: The Den Theatre''s five stages make it a destination. Lots of emerging companies find homes here.

**Hyde Park**: Court Theatre brings classical weight to the South Side. University of Chicago campus gives it a cerebral vibe.

**Loop / River North**: Chicago Shakespeare on Navy Pier, Goodman Theatre. The tourist-friendly, big-budget tier.

**Pilsen / Back of the Yards**: Growing hub for Latinx theater and community-driven work. Collaboraction does incredible site-specific pieces here.',
   'guide', 1),

  (gen_random_uuid(), 'improv-vs-sketch', 'Improv vs. Sketch: What''s the Difference?',
   '**Improv** is made up on the spot. No script, no rehearsal for the specific scenes you see. The performers are creating everything in real time based on audience suggestions and their own instincts.

- **Short-form**: Quick games with rules (like Whose Line Is It Anyway?). Second City sets often end with short-form.
- **Long-form**: Extended scenes and narratives built from a single suggestion. The Harold is the classic format, invented at iO.

**Sketch** is written and rehearsed. It looks spontaneous, but every word is scripted. Second City''s mainstage revues are sketch. SNL is sketch.

**Musical improv** is the wild card: improvised songs, sometimes entire improvised musicals. The Annoyance is the king of this.

The line blurs constantly. Many shows mix forms. The best way to understand the difference is to see both — which you should, because Chicago is the best city in the world for both.',
   'genre', 1),

  (gen_random_uuid(), 'who-is-steppenwolf', 'Steppenwolf: The Company That Changed Everything',
   'In 1974, a bunch of college kids started a theater company in a church basement in Highland Park. They had no money, no training, and no patience for the polite, well-mannered theater of the time.

They called themselves Steppenwolf.

The founding ensemble included Terry Kinney, Jeff Perry, and a young Gary Sinise. Joan Allen and John Malkovich joined soon after. Laurie Metcalf. John Mahoney. Tracy Letts.

Their style was raw, physical, confrontational. Critics called it "the Chicago style" — acting so honest it felt dangerous. Sam Shepard''s True West directed by Sinise became a landmark. Balm in Gilead had a cast of 30 and ran through a real-looking flophouse.

Today Steppenwolf is an institution, but they''ve kept the ensemble model and the commitment to new work. August: Osage County, which started at Steppenwolf, won the Pulitzer and Tony. They''re still making theater that punches you in the gut.',
   'venue', 1),

  -- Orange Belt (2) - Going deeper
  (gen_random_uuid(), 'devised-theater', 'What Is Devised Theater?',
   'Most theater starts with a script. Devised theater starts with... anything else.

An ensemble might begin with a question ("What does home mean in Pilsen?"), an image, a piece of music, or a news article. Through weeks or months of improvisation, research, and collaboration, they build the show together. No single playwright. The whole team creates.

This is huge in Chicago. Companies like Lookingglass, The House Theatre, and 500 Clowns are known for devised work. Collaboraction''s peacebooks are devised from community interviews.

Why does it matter? Because devised theater can go places a single writer can''t. It draws on multiple perspectives, multiple bodies, multiple imaginations. The result is often more physical, more visual, and more surprising than traditionally scripted work.

The tradeoff: devised theater takes longer to make and can be uneven. But when it works, nothing else feels like it.',
   'genre', 2),

  (gen_random_uuid(), 'neo-futurists-history', 'The Neo-Futurists: 30 Plays in 60 Minutes',
   'In 1988, Greg Allen founded the Neo-Futurists with a radical premise: no pretend. Everything on stage is real. The performers use their real names. They don''t play characters. Time is real — when the clock starts, it starts.

Their flagship show was "Too Much Light Makes the Baby Go Blind" — 30 short plays performed in 60 minutes, in random order determined by audience members shouting numbers. It ran for 30 years.

The successor, "The Infinite Wrench," keeps the same format with rotating plays. Some are funny, some are devastating, some are bizarre. You might see a love poem, a political rant, and a dance piece in the span of five minutes.

Ticket pricing is punk rock: roll a die, add $9. That''s your price.

The Neo-Futurists are proof that theater doesn''t have to be expensive, long, or conventional to be powerful. They''re also proof that Andersonville is one of the most important theater neighborhoods in the country.',
   'venue', 2),

  (gen_random_uuid(), 'what-is-site-specific', 'Site-Specific Theater: When the Space IS the Show',
   'Site-specific theater happens in a real location instead of a theater building. A play about a factory performed in an actual factory. A ghost story told in a real cemetery. A piece about immigration staged in a shuttered courthouse.

In Chicago, this tradition is alive and wild:

- **Collaboraction** performs in community spaces across the city
- **The Hypocrites** staged a production of Pirates of Penzance in a bar, with the audience seated at cocktail tables
- **Redmoon Theater** (RIP) once built an entire miniature city on a frozen lagoon in Humboldt Park

The appeal: the space does half the storytelling work. You don''t need to imagine you''re in a warehouse when you''re literally standing in one. The danger is real, the cold is real, the smell is real.

The challenge for audiences: you might be standing, walking, or sitting on the floor. Wear comfortable shoes.',
   'genre', 2),

  -- Green Belt (3) - Deeper knowledge
  (gen_random_uuid(), 'chicago-playwrights', 'Chicago Playwrights You Should Know',
   '**Tracy Letts**: Pulitzer winner for August: Osage County. Also wrote Bug, Killer Joe, and The Minutes. Steppenwolf ensemble member and Oscar-nominated actor. The biggest name in Chicago theater.

**Rebecca Gilman**: Spinning Into Butter, Blue Surge, Luna Gale. Writes about race, class, and Midwestern guilt with surgical precision. Goodman Theatre mainstay.

**Philip Dawkins**: Failure: A Love Story, The Burn. Young playwright exploring identity, queerness, and family with warmth and wit.

**Sandra Delgado**: La Havana Madrid. Creates bilingual, music-driven work about Latinx communities in Chicago. A pioneer of devised documentary theater.

**Isaac Gomez**: The Way She Spoke, La Ruta. Writes about femicide, immigration, and Mexican-American identity. Urgent, heartbreaking work.

**Ike Holter**: The "Rightlynd Saga" — seven plays set in a fictional Chicago ward. Chronicles gentrification, corruption, and community resistance. The most ambitious dramatic project in Chicago theater history.',
   'playwright', 3),

  (gen_random_uuid(), 'how-to-volunteer-usher', 'How to Usher (And See Shows for Free)',
   'Here''s a secret: you can see most storefront theater shows for free by volunteering to usher.

**How it works**: You show up 30-45 minutes before the show. You hand out programs, help people find seats, and maybe sweep up after. In return, you see the show for free.

**Where to sign up**: Most companies have an "Usher" or "Volunteer" link on their website. Some use SignUpGenius or Google Forms. Popular shows fill up fast — sign up early.

**What to expect**: You''ll need to dress in all black (usually). Arrive on time. Be friendly. Stay for the whole show.

**Pro tip**: Ushering is also one of the best ways to meet other theater people. Regulars usher at the same companies, and you''ll start recognizing faces. It''s a side door into the community.

Companies that regularly need ushers: Steep, Raven, A Red Orchid, Profiles, The House Theatre, Jackalope, and basically every storefront in the city.',
   'guide', 3)
ON CONFLICT DO NOTHING;
