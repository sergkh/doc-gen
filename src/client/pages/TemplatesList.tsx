import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faPen, faDownload } from "@fortawesome/free-solid-svg-icons";
import type { Template } from "@/stores/models";
import { loadAllTemplates, deleteTemplate } from "../templates";

export default function TemplatesList() {
  const navigate = useNavigate();

  const [items, setItems] = useState<Template[]>([]);

  useEffect(() => {
    loadAllTemplates().then(setItems).catch(console.error);
  }, []);

  const handleDelete = async (template: Template) => {
    if (!confirm(`Ви впевнені, що хочете видалити шаблон "${template.name}"?`)) {
      return;
    }

    try {
      await deleteTemplate(template.id);
      setItems(items.filter(t => t.id !== template.id));
    } catch (error) {
      console.error("Error deleting template:", error);
      alert("Не вдалося видалити шаблон");
    }
  };

  const handleDownload = async (template: Template) => {
    try {
      const response = await fetch(`/api/templates/${template.id}/download`);
      if (!response.ok) {
        throw new Error("Failed to download template");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${template.name}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading template:", error);
      alert("Не вдалося завантажити шаблон");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
      <div className="mt-8 mx-auto w-full text-left flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <h1 className="font-mono">Шаблони</h1>
          <button
            onClick={() => navigate("/templates/new")}
            className="text-amber-50 hover:text-amber-200 px-4 py-2 rounded-lg font-bold flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faPlus} />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {items.length === 0 ? (
            <div className="text-amber-50 font-mono">Немає шаблонів</div>
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map(t => (
                <li key={t.id} className="bg-zinc-900 border-2 border-amber-50 rounded-xl p-3 text-amber-50 font-mono flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-bold">{t.name}</div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleDownload(t)} 
                      className="text-amber-50 hover:text-blue-400 opacity-60 hover:opacity-100 transition-opacity p-1.5 rounded"
                      aria-label="Завантажити шаблон"
                      title="Завантажити шаблон"
                    >
                      <FontAwesomeIcon icon={faDownload} />
                    </button>
                    <button 
                      onClick={() => navigate(`/templates/${t.id}`)} 
                      className="text-amber-50 hover:text-amber-200 opacity-60 hover:opacity-100 transition-opacity p-1.5 rounded"
                      aria-label="Редагувати шаблон"
                      title="Редагувати шаблон"
                    >
                      <FontAwesomeIcon icon={faPen} />
                    </button>
                    <button 
                      onClick={() => handleDelete(t)} 
                      className="text-amber-50 hover:text-red-400 opacity-60 hover:opacity-100 transition-opacity p-1.5 rounded"
                      aria-label="Видалити шаблон"
                      title="Видалити шаблон"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <details className="bg-zinc-900 border-2 border-amber-50 rounded-xl p-5 text-amber-50 font-mono">
          <summary className="cursor-pointer font-bold flex items-center justify-between">
            <span>Пам'ятка по шаблонам генерації</span>
            <span className="text-xs uppercase tracking-widest">Розгорнути</span>
          </summary>

          <div className="mt-4 flex flex-col gap-4 text-sm leading-relaxed">
            <section>
              <h2 className="text-amber-200 uppercase text-xs tracking-widest mb-2">Базовий синтаксис шаблонів документів (word)</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li><code>{"{{course.name}}"}</code> — вставка одиночного значення.</li>
                <li><code>{"{{#topics}} … {{/topics}}"}</code> — цикл по темах (всередині доступні поля теми, наприклад <code>{"{{title}}"}</code>).</li>
                <li><code>{"{{hours.fulltime.lectures}}"}</code> — доступ до вкладених властивостей через крапку.</li>
                <li><code>{"{{course.name | uppercase}}"}</code> — використання <a className="text-amber-600" href="https://github.com/sergkh/doc-gen/blob/main/src/docx/render.ts#L37">фільтрів</a> для форматування (наприклад, перетворення в верхній регістр).</li>
              </ul>
            </section>
            <section>
              <h2 className="text-amber-200 uppercase text-xs tracking-widest mb-2">Для текстових/xml документів використовується <a className="text-amber-600" href="https://handlebarsjs.com">Handlebars</a></h2>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><code>{'{{variable}}' }</code> — вставка значення змінної.</li>
                <li><code>{'{{#each array}}…{{/each}}' }</code> — цикл по масиву.</li>
                <li><code>{'{{#if condition}}…{{/if}}' }</code> — умовний блок.</li>
                <li><code>{'{{#unless condition}}…{{/unless}}' }</code> — блок, який виконується, якщо умова хибна.</li>
                <li><code>{'{{#with object}}…{{/with}}' }</code> — контекст для вкладених властивостей об'єкта.</li>
              </ul>
            </section>
            <section>
              <h2 className="text-amber-200 uppercase text-xs tracking-widest mb-2">Об'єкт CourseGenerationData</h2>
              <p>Усередині Docxtemplator шаблону доступний кореневий об'єкт, що відповідає структурі <a className="text-amber-600" href="https://github.com/sergkh/doc-gen/blob/main/src/stores/models.ts#L160">CourseGenerationData</a>. Основні поля:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><code>course</code> — повна інформація про курс (назва, опис, викладачі).</li>
                <li><code>topics</code> — масив тем з назвами, змістом та годинами.</li>
                <li><code>prerequisites</code> / <code>postrequisites</code> — пов'язані дисципліни.</li>
                <li><code>generalResults</code>, <code>specialResults</code>, <code>programResults</code> — навчальні результати різних типів.</li>
                <li><code>semesters</code> та <code>attestations</code> — структура семестрів і атестацій з розбивкою годин.</li>
                <li><code>oneSemesterOnly</code> — булевий прапорець для спрощення умов.</li>
                <li><code>hours</code> — агреговані години (<code>fulltime</code> / <code>inabscentia</code>, лекції, практики, СРС).</li>
                <li>будь-які додаткові параметри, які ви додаєте в інтерфейсі шаблону.</li>
              </ul>
            </section>
          </div>
        </details>
      </div>
    </div>
  );
}

