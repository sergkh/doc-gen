import type { Teacher } from '@/stores/models';
import * as cheerio from 'cheerio';
import { parse } from 'handlebars';
import { splitTeacherName } from './utils';

const typesMapping: Record<string, string> = {
  "СSc": "Scopus",
  "Сун": "Article", // Фахова стаття
  "Мв": "Methodical work", // Методичні вказівки
};

interface Publication {
  title: string;
  authors: string[];
  year: string;
  type: string;
  link: string;
}

async function fetchLiterature(lastName: string, firstName?: string): Promise<Publication[]> {
  const publications: Publication[] = [];

  const url = `https://socrates.vsau.org/repository/search.php?lang=en&filtr_authors=${encodeURIComponent(lastName)}&filtr_butt.x=0&filtr_butt.y=0`;
  
  try {
      const response = await fetch(url);
      const html = await response.text();
      const $ = cheerio.load(html);

      console.log(`Parsing publications for: ${lastName} ${firstName}`);
      
      $('#t').each((i, el) => {
        $(el).find('tr').each((j, row) => {
          if (j === 0) return; // Skip header row
          const cols = $(row).find('td').map((k, cell) => $(cell).text().trim()).get();          
          
          if (cols.length < 5) return; // Skip rows with insufficient data
          
          const [id, year, title, authorsStr, type] = cols;

          if (!id || !title || !year || !authorsStr || !type) {
            console.warn(`Skipping incomplete publication data: ${cols.join(', ')}`);
            return; // Ensure essential fields are present
          }

          const authors = authorsStr?.split(',').map(author => author.trim()) ?? [authorsStr];
          
          console.log(`Found publication: ${id} ${title} by ${authors} (${year}) type: ${type}`);

          if (authors.some(author => author.includes(lastName + (firstName ? ` ${firstName.substring(0, 1)}.` : '')))) {
            publications.push({
              title,
              authors,
              year,
              type: typesMapping[type] || "Unknown",
              link: `https://socrates.vsau.org/repository/view.php?id=${id}`
            });
          } else {
            console.warn(`Skipping publication not authored by ${firstName || lastName}: ${title}`);
          }
        });
      });
  } catch (error) {
      console.error(`Error fetching data for teacher: ${lastName} ${firstName}`, error);
  }
  return publications;
}
export async function fetchTeacherPublications(teacher: Teacher): Promise<Publication[]> {  
  const { lastName, firstName } = splitTeacherName(teacher.name);

  let publications: Set<Publication> = new Set();
  const pubsMain = await fetchLiterature(lastName, firstName);
  pubsMain.forEach(pub => publications.add(pub));

  if (!teacher.alt_names || teacher.alt_names.length === 0) return Array.from(publications);

  for (let name in teacher.alt_names) {
    const { lastName , firstName } = splitTeacherName(name);    
    const additionalPubs = await fetchLiterature(lastName, firstName);
    additionalPubs.forEach(pub => publications.add(pub));
  }

  return Array.from(publications);
}

await fetchLiterature("Хрущак", "Сергій");