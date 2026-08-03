-- Seed canonical plays commonly produced in Chicago theaters
-- Source: Manual curation from Chicago theater seasons 2020-2026

INSERT INTO plays (title, slug, playwright, year_written, awards, synopsis) VALUES
-- Classics
('A Doll''s House', 'a-dolls-house', 'Henrik Ibsen', 1879, '{}', 'Nora Helmer discovers that her comfortable marriage is built on secrets and lies, and must choose between domestic obligation and personal freedom.'),
('Hamlet', 'hamlet', 'William Shakespeare', 1601, '{}', 'A prince of Denmark struggles with grief, revenge, and madness after his father''s ghost reveals he was murdered by his own brother.'),
('A Streetcar Named Desire', 'a-streetcar-named-desire', 'Tennessee Williams', 1947, ARRAY['Pulitzer Prize for Drama, 1948'], 'Fading Southern belle Blanche DuBois arrives at her sister Stella''s cramped New Orleans apartment, where she clashes violently with Stella''s brutish husband Stanley.'),
('Death of a Salesman', 'death-of-a-salesman', 'Arthur Miller', 1949, ARRAY['Pulitzer Prize for Drama, 1949', 'Tony Award for Best Play, 1949'], 'Aging salesman Willy Loman confronts the gap between his dreams of success and the reality of his life, as his family fractures around him.'),
('The Glass Menagerie', 'the-glass-menagerie', 'Tennessee Williams', 1944, ARRAY['New York Drama Critics'' Circle Award, 1945'], 'Tom Wingfield narrates the memory of his overbearing mother Amanda and fragile sister Laura, trapped in a St. Louis tenement during the Depression.'),
('Romeo and Juliet', 'romeo-and-juliet', 'William Shakespeare', 1597, '{}', 'Two teenagers from feuding families fall in love in Verona, with devastating consequences.'),
('A Midsummer Night''s Dream', 'a-midsummer-nights-dream', 'William Shakespeare', 1596, '{}', 'Lovers, fairies, and amateur actors collide in an enchanted forest outside Athens, where nothing is what it seems.'),
('The Crucible', 'the-crucible', 'Arthur Miller', 1953, ARRAY['Tony Award for Best Play, 1953'], 'The Salem witch trials become an allegory for McCarthyism as a community tears itself apart through accusation and paranoia.'),
('Our Town', 'our-town', 'Thornton Wilder', 1938, ARRAY['Pulitzer Prize for Drama, 1938'], 'A Stage Manager narrates daily life, love, and death in the small town of Grover''s Corners, New Hampshire.'),
('Who''s Afraid of Virginia Woolf?', 'whos-afraid-of-virginia-woolf', 'Edward Albee', 1962, ARRAY['Tony Award for Best Play, 1963'], 'A married couple invites a younger pair over for late-night drinks that devolve into a savage verbal war.'),

-- Modern American classics
('Fences', 'fences', 'August Wilson', 1985, ARRAY['Pulitzer Prize for Drama, 1987', 'Tony Award for Best Play, 1987'], 'Former Negro League baseball player Troy Maxson builds fences both physical and emotional around his family in 1950s Pittsburgh.'),
('Angels in America: Millennium Approaches', 'angels-in-america-millennium-approaches', 'Tony Kushner', 1991, ARRAY['Pulitzer Prize for Drama, 1993', 'Tony Award for Best Play, 1993'], 'In Reagan-era America, a gay man with AIDS, a closeted Mormon lawyer, and the ghost of Ethel Rosenberg collide in a epic vision of national identity.'),
('August: Osage County', 'august-osage-county', 'Tracy Letts', 2007, ARRAY['Pulitzer Prize for Drama, 2008', 'Tony Award for Best Play, 2008'], 'When the patriarch of the Weston family disappears, his pill-addicted wife Violet summons her three daughters home to Oklahoma for a reckoning.'),
('A Raisin in the Sun', 'a-raisin-in-the-sun', 'Lorraine Hansberry', 1959, ARRAY['New York Drama Critics'' Circle Award, 1959'], 'An African American family on Chicago''s South Side grapples with how to spend a life insurance check, each member harboring a different dream.'),
('Topdog/Underdog', 'topdog-underdog', 'Suzan-Lori Parks', 2001, ARRAY['Pulitzer Prize for Drama, 2002'], 'Two brothers named Lincoln and Booth hustle to survive in a seedy rooming house, their rivalry echoing the nation''s original fratricide.'),
('The Humans', 'the-humans', 'Stephen Karam', 2015, ARRAY['Tony Award for Best Play, 2016'], 'The Blake family gathers for Thanksgiving in a crumbling Chinatown duplex, where the sounds of the building amplify their fears about money, health, and mortality.'),

-- Chicago-connected playwrights
('Bug', 'bug', 'Tracy Letts', 1996, '{}', 'A lonely waitress and a Gulf War veteran barricade themselves in an Oklahoma motel room, descending into shared paranoid delusion.'),
('Killer Joe', 'killer-joe', 'Tracy Letts', 1993, '{}', 'A trailer-park family hires a detective-turned-hitman to murder a relative for insurance money, but the plan spirals out of control.'),
('Superior Donuts', 'superior-donuts', 'Tracy Letts', 2008, '{}', 'A aging hippie runs a donut shop in Chicago''s Uptown neighborhood, where an ambitious young employee forces him to confront his past.'),
('The Minutes', 'the-minutes', 'Tracy Letts', 2017, '{}', 'A small-town city council meeting becomes a pressure cooker when a new member asks what happened at the last meeting he missed.'),
('Race', 'race', 'David Mamet', 2009, '{}', 'Two lawyers — one Black, one white — and their new associate must decide whether to defend a wealthy white man accused of raping a Black woman.'),
('Glengarry Glen Ross', 'glengarry-glen-ross', 'David Mamet', 1982, ARRAY['Pulitzer Prize for Drama, 1984'], 'Desperate real estate salesmen scheme, lie, and betray each other in a ruthless contest to keep their jobs.'),
('American Buffalo', 'american-buffalo', 'David Mamet', 1975, '{}', 'Three small-time crooks in a Chicago junk shop plan a coin heist that exposes the violence beneath American free enterprise.'),

-- Contemporary hits commonly produced
('Clyde''s', 'clydes', 'Lynn Nottage', 2021, '{}', 'Workers at a truck-stop sandwich shop run by an ex-con tyrant dream of creating the perfect sandwich as a path to redemption.'),
('The Lehman Trilogy', 'the-lehman-trilogy', 'Stefano Massini', 2013, ARRAY['Tony Award for Best Play, 2022'], 'Three brothers from Bavaria build a cotton trading business in 1840s Alabama that evolves over 163 years into one of the world''s most powerful financial institutions.'),
('The Inheritance', 'the-inheritance', 'Matthew Lopez', 2018, ARRAY['Tony Award for Best Play, 2020'], 'Inspired by Howards End, two generations of gay men in New York grapple with the legacy of the AIDS crisis and what it means to build a home.'),
('Sweat', 'sweat', 'Lynn Nottage', 2015, ARRAY['Pulitzer Prize for Drama, 2017'], 'Factory workers in Reading, Pennsylvania turn on each other as their jobs disappear and old friendships shatter along racial lines.'),
('Pass Over', 'pass-over', 'Antoinette Nwandu', 2017, '{}', 'Two young Black men on a street corner dream of escaping to the promised land, in a play that fuses Waiting for Godot with the Exodus story.'),
('Hype Man', 'hype-man', 'Idris Goodwin', 2018, '{}', 'A hip-hop trio on the verge of stardom must decide whether to use their platform to address police violence after a shooting in their hometown.'),
('Choir Boy', 'choir-boy', 'Tarell Alvin McCraney', 2012, '{}', 'A gay student at an elite Black prep school fights for his place as choir leader while the school grapples with tradition and masculinity.'),
('Fat Ham', 'fat-ham', 'James Ijames', 2021, ARRAY['Pulitzer Prize for Drama, 2022'], 'A queer Black college student must confront his father''s ghost at a family barbecue, in a joyful reimagining of Hamlet.'),
('Appropriate', 'appropriate', 'Branden Jacobs-Jenkins', 2013, '{}', 'Three siblings reunite at their late father''s decaying Arkansas plantation to settle the estate, unearthing disturbing family secrets.'),
('The Great Leap', 'the-great-leap', 'Lauren Yee', 2018, '{}', 'An American basketball team travels to Beijing in 1989 for a friendship game, connecting a young Chinese-American player to the country his family fled.'),

-- Musicals commonly produced in Chicago
('Hamilton', 'hamilton', 'Lin-Manuel Miranda', 2015, ARRAY['Pulitzer Prize for Drama, 2016', 'Tony Award for Best Musical, 2016'], 'The life of founding father Alexander Hamilton told through hip-hop, R&B, and the faces of a diverse cast.'),
('Hadestown', 'hadestown', 'Anaïs Mitchell', 2019, ARRAY['Tony Award for Best Musical, 2019'], 'The myth of Orpheus and Eurydice set in a Depression-era underworld ruled by the industrialist god Hades.'),
('Six', 'six', 'Toby Marlow & Lucy Moss', 2017, ARRAY['Tony Award for Best Musical, 2022'], 'The six wives of Henry VIII take the stage as pop divas, competing to determine whose story of heartbreak is the worst.'),
('Dear Evan Hansen', 'dear-evan-hansen', 'Benj Pasek & Justin Paul', 2015, ARRAY['Tony Award for Best Musical, 2017'], 'A socially anxious teen gets caught up in a lie after a classmate''s suicide, becoming an unlikely viral hero.'),
('The Color Purple', 'the-color-purple', 'Marsha Norman', 2005, ARRAY['Tony Award for Best Musical Revival, 2016'], 'Celie''s journey from abuse to self-discovery in the rural American South, adapted from Alice Walker''s novel.'),

-- Recent Chicago premieres / world premieres
('Leopoldstadt', 'leopoldstadt', 'Tom Stoppard', 2020, ARRAY['Tony Award for Best Play, 2023'], 'A Jewish family in Vienna navigates identity, assimilation, and survival across the first half of the twentieth century.'),
('Grey House', 'grey-house', 'Levi Holloway', 2023, '{}', 'A couple seeks shelter from a storm in an abandoned house in the Catskills, where they encounter spectral inhabitants trapped in a loop.'),
('English', 'english', 'Sanaz Toossi', 2022, ARRAY['Pulitzer Prize for Drama, 2023'], 'Four Iranian students study for their English proficiency exam, revealing how language shapes identity.'),
('Primary Trust', 'primary-trust', 'Eboni Booth', 2024, ARRAY['Pulitzer Prize for Drama, 2024'], 'A shy bookstore clerk loses his job and must navigate new relationships and an unfamiliar world.'),
('Stereophonic', 'stereophonic', 'David Adjmi', 2023, ARRAY['Tony Award for Best Play, 2024'], 'A rock band in a 1970s recording studio creates a landmark album while their personal relationships disintegrate.'),
('Mother Play', 'mother-play', 'Paula Vogel', 2023, '{}', 'A mother and her two children navigate decades of family dysfunction in a kaleidoscopic memory play.')

ON CONFLICT (slug) DO NOTHING;
