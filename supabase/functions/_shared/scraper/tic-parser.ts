import type { TicShow, TicDetailData } from "./types.ts";

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

function parseDate(text: string): string | null {
  const cleaned = text.replace(/\s+/g, " ").trim();

  const full = cleaned.match(/(\w{3})\s+(\d{1,2}),?\s+(\d{4})/);
  if (full) {
    const m = MONTHS[full[1].toLowerCase().slice(0, 3)];
    if (m) return `${full[3]}-${m}-${full[2].padStart(2, "0")}`;
  }

  const current = new Date();
  const shortMatch = cleaned.match(/(\w{3})\s+(\d{1,2})/);
  if (shortMatch) {
    const m = MONTHS[shortMatch[1].toLowerCase().slice(0, 3)];
    if (m) {
      const year = current.getFullYear();
      const monthNum = parseInt(m);
      const guessYear = monthNum < current.getMonth() + 1 ? year + 1 : year;
      return `${guessYear}-${m}-${shortMatch[2].padStart(2, "0")}`;
    }
  }

  return null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

export function parseTicListingPage(html: string): TicShow[] {
  const results: TicShow[] = [];
  const postPattern = /<div class="post post-list-item">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;

  let match: RegExpExecArray | null;
  while ((match = postPattern.exec(html)) !== null) {
    const block = match[1];

    const titleMatch = block.match(/<a href="(\/[^"]+\/)">[\s\S]*?<strong>([^<]+)<\/strong>/);
    if (!titleMatch) continue;

    const detailUrl = `https://www.theatreinchicago.com${titleMatch[1]}`;
    const title = decodeEntities(titleMatch[2].trim());

    const venueMatch = block.match(/<div class="theatre-name">[\s\S]*?(?:<a[^>]*>)?\s*([^<]+?)\s*(?:<\/a>)?[\s\S]*?<\/div>/);
    let venueName = "";
    if (venueMatch) {
      const venueHtml = block.match(/<div class="theatre-name">([\s\S]*?)<\/div>/);
      if (venueHtml) {
        const linkVenue = venueHtml[1].match(/<a[^>]*>\s*([^<]+?)\s*<\/a>/);
        const companyMatch = venueHtml[1].match(/<span class="redbody">([^<]+)<\/span>/);
        const company = companyMatch ? companyMatch[1].replace(/\s+at\s*$/, "").trim() : "";
        venueName = linkVenue ? linkVenue[1].trim() : "";
        if (company && venueName) venueName = `${company} at ${venueName}`;
        else if (company) venueName = company;
      }
    }

    const dateMatch = block.match(/<span class="open-date">\s*([\s\S]*?)\s*<\/span>/);
    let startDate: string | null = null;
    let endDate: string | null = null;

    if (dateMatch) {
      const dateText = dateMatch[1].replace(/\s+/g, " ").trim();
      const rangeParts = dateText.split(/\s*-\s*/);
      if (rangeParts.length === 2) {
        startDate = parseDate(rangeParts[0]);
        endDate = parseDate(rangeParts[1]);
      } else {
        const thruMatch = dateText.match(/thru\s+(.+)/i);
        if (thruMatch) endDate = parseDate(thruMatch[1]);
        else startDate = parseDate(dateText);
      }
    }

    const photoMatch = block.match(/<img\s+src="([^"]+)"/);
    const photoUrl = photoMatch ? photoMatch[1] : null;

    results.push({ title, venueName, detailUrl, startDate, endDate, photoUrl });
  }

  return results;
}

function parseTime12to24(time12: string): string {
  const match = time12.trim().match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (!match) return time12.trim();
  let h = parseInt(match[1]);
  const m = match[2];
  const period = match[3].toLowerCase();
  if (period === "pm" && h !== 12) h += 12;
  if (period === "am" && h === 12) h = 0;
  return `${h.toString().padStart(2, "0")}:${m}`;
}

const DAY_MAP: Record<string, string> = {
  sun: "sun", mon: "mon", tue: "tue", wed: "wed", thu: "thu", fri: "fri", sat: "sat",
};

export function parseTicDetailPage(html: string): TicDetailData {
  let startDate: string | null = null;
  let endDate: string | null = null;

  const playDateMatch = html.match(/<p class="detailbody play-date">\s*([\s\S]*?)\s*<\/p>/);
  if (playDateMatch) {
    const dateText = playDateMatch[1].replace(/\s+/g, " ").trim();
    const thruMatch = dateText.match(/thru\s*-?\s*(.+)/i);
    if (thruMatch) {
      endDate = parseDate(thruMatch[1]);
      const now = new Date();
      startDate = now.toISOString().slice(0, 10);
    } else {
      const rangeParts = dateText.split(/\s*-\s*/);
      if (rangeParts.length === 2) {
        startDate = parseDate(rangeParts[0]);
        endDate = parseDate(rangeParts[1]);
      }
    }
  }

  const showTimes: Record<string, string[]> = {};
  const dayPattern = /<div class="daysTableRow">[\s\S]*?<span class="day-name">\s*([\s\S]*?)\s*<\/span>[\s\S]*?<span class="detailbody">\s*([\s\S]*?)\s*<\/span>[\s\S]*?<\/div>/g;
  let dayMatch: RegExpExecArray | null;
  while ((dayMatch = dayPattern.exec(html)) !== null) {
    const dayText = dayMatch[1].replace(/\s+/g, " ").trim();
    const timesText = dayMatch[2].replace(/\s+/g, " ").trim();

    const dayAbbr = dayText.slice(0, 3).toLowerCase();
    const dayKey = DAY_MAP[dayAbbr];
    if (!dayKey) continue;

    const times = timesText.split(/\s*&\s*/).map(parseTime12to24).filter(Boolean);
    if (times.length > 0) {
      if (!showTimes[dayKey]) showTimes[dayKey] = [];
      showTimes[dayKey].push(...times);
    }
  }

  const ticketMatch = html.match(/<a href="([^"]+)"[^>]*>\s*Buy Tickets\s*<\/a>/i);
  const ticketUrl = ticketMatch ? ticketMatch[1] : null;

  let genre: string | null = null;
  const genreMatch = html.match(/genre[:\s]*<[^>]*>([^<]+)/i);
  if (genreMatch) genre = genreMatch[1].trim().toLowerCase();

  return {
    title: "",
    startDate,
    endDate,
    showTimes: Object.keys(showTimes).length > 0 ? showTimes : null,
    ticketUrl,
    cast: null,
    genre,
  };
}
