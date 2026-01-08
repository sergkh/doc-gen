import type { Teacher, TeacherPublication, TeacherPublicationType } from '@/stores/models';
import * as cheerio from 'cheerio';
import { parse } from 'handlebars';
import { splitTeacherName } from './utils';

const typesMapping: Record<string, TeacherPublicationType> = {
  "СSc": "Scopus",
  "Сун": "Article", // Фахова стаття
  "Мв": "Methodical work", // Методичні вказівки
};

type Publication = Omit<TeacherPublication, "id">;

async function getArticleDetails(repoId: string): Promise<{abstract: string; keywords: string[], publication: string}> {
  const url = `https://socrates.vsau.org/repository/card.php?lang=en&id=${encodeURIComponent(repoId)}`;
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);

  const data: any = {}

  $('table td>b').filter(el => el.text()).each((i, el) => {
    const label = $(el).text().trim();
    const next = $(el).next().next();
    if ($(el).text().includes('Keywords:')) {
      console.log('Found keywords', next.text());
    }
  });

  console.log(`Fetched article details for repo ID: ${repoId}`, data);

  return data as {abstract: string; keywords: string[], publication: string};
}

async function fetchLiterature(lastName: string, firstName?: string, teacherId: number = -1): Promise<Publication[]> {
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
          
          if (authors.some(author => author.includes(lastName + (firstName ? ` ${firstName.substring(0, 1)}.` : '')))) {
            const publication: Omit<TeacherPublication, "id"> = {
              teacher_id: teacherId,
              repo_id: id,
              title,
              year: year ? parseInt(year) : null,
              data: {
                authors,
                link: `https://socrates.vsau.org/repository/view.php?id=${id}`,
              },
              journal: 'TBD',
              publication_type: typesMapping[type] ?? "Unknown"
            };

            publications.push(publication);
          } else {
            console.warn(`Skipping publication not authored by ${firstName || lastName}: ${title}`);
          }
        });
      });

      for (let pub of publications) {
        try {
          const details = await getArticleDetails(pub.repo_id!);
        } catch (error) {
          console.error(`Error fetching details for publication ID: ${pub.repo_id}`, error);
        }
      }

  } catch (error) {
      console.error(`Error fetching data for teacher: ${lastName} ${firstName}`, error);
  }
  return publications;
}
export async function fetchTeacherPublications(teacher: Teacher): Promise<Omit<TeacherPublication, "id">[]> {  
  const { lastName, firstName } = splitTeacherName(teacher.name);

  let publications: Set<Publication> = new Set();
  const pubsMain = await fetchLiterature(lastName, firstName, teacher.id);
  pubsMain.forEach(pub => publications.add(pub));

  if (!teacher.alt_names || teacher.alt_names.length === 0) return Array.from(publications);

  console.log("Alt names found:", teacher.alt_names);

  for (let name of teacher.alt_names) {
    const { lastName , firstName } = splitTeacherName(name);
    const additionalPubs = await fetchLiterature(lastName, firstName, teacher.id);
    additionalPubs.forEach(pub => publications.add(pub));
  }

  console.log(`Found publications:`, publications);

  return Array.from(publications);
}