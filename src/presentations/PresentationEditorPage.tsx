import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Reorder, useDragControls } from "motion/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faChevronLeft,
  faChevronRight,
  faClockRotateLeft,
  faGripVertical,
  faList,
  faPen,
  faPlus,
  faRotateLeft,
  faSave,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import {
  ActionIcon,
  Badge,
  Button,
  Center,
  Divider,
  Drawer,
  Group,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import toast from "react-hot-toast";
import type { PresentationHistoryEntry, PresentationState } from "./models";
import {
  loadPresentation,
  loadPresentationHistory,
  previewSlide,
  replaceSlides,
  restorePresentationRevision,
  updateSlides,
} from "./client";

type EditorSlide = {
  key: string;
  markdown: string;
};

function createEditorSlides(state: PresentationState): EditorSlide[] {
  return state.slides.map((slide) => ({ key: crypto.randomUUID(), markdown: slide.markdown }));
}

function title(markdown: string, index: number): string {
  return markdown.match(/^\s*#{1,6}\s+(.+)$/m)?.[1]?.trim() || `Слайд ${index}`;
}

function SlideItem({
  slide,
  index,
  selected,
  onSelect,
}: {
  slide: EditorSlide;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={slide}
      dragListener={false}
      dragControls={controls}
      style={{ listStyle: "none" }}
    >
      <Paper
        withBorder
        p="xs"
        bg={selected ? "var(--mantine-color-blue-light)" : undefined}
        onClick={onSelect}
        style={{ cursor: "pointer" }}
      >
        <Group wrap="nowrap" gap="xs">
          <div
            aria-label="Змінити порядок слайда"
            onPointerDown={(event) => controls.start(event)}
            style={{ cursor: "grab", touchAction: "none", color: "var(--mantine-color-dimmed)", padding: 4 }}
          >
            <FontAwesomeIcon icon={faGripVertical} />
          </div>
          <div style={{ minWidth: 0 }}>
            <Text size="xs" c="dimmed">{index}</Text>
            <Text size="sm" fw={selected ? 700 : 500} truncate>{title(slide.markdown, index)}</Text>
          </div>
        </Group>
      </Paper>
    </Reorder.Item>
  );
}

export default function PresentationEditorPage() {
  const { courseId, topicUid } = useParams<{ courseId: string; topicUid: string }>();
  const id = Number(courseId);
  const uid = topicUid ?? "";
  const [presentation, setPresentation] = useState<PresentationState | null>(null);
  const [slides, setSlides] = useState<EditorSlide[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [preview, setPreview] = useState<{ html: string; css: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [orderDirty, setOrderDirty] = useState(false);
  const [history, setHistory] = useState<PresentationHistoryEntry[]>([]);
  const [historyOpened, historyControls] = useDisclosure(false);
  const [slidesOpened, slidesControls] = useDisclosure(false);
  const [editorOpened, editorControls] = useDisclosure(false);

  const selectedIndex = Math.max(0, slides.findIndex((slide) => slide.key === selectedKey));
  const selectedSlide = slides[selectedIndex];

  const applyState = (state: PresentationState) => {
    const editorSlides = createEditorSlides(state);
    setPresentation(state);
    setSlides(editorSlides);
    setSelectedKey(editorSlides[Math.min(selectedIndex, editorSlides.length - 1)]?.key ?? "");
    setOrderDirty(false);
  };

  const reload = () => loadPresentation(id, uid)
    .then(applyState)
    .catch((error) => toast.error(error.message));

  useEffect(() => { void reload(); }, [id, uid]);

  useEffect(() => {
    if (!selectedSlide || !presentation) return;
    const timeout = window.setTimeout(() => {
      previewSlide(id, uid, selectedIndex + 1, selectedSlide.markdown)
        .then(setPreview)
        .catch((error) => toast.error(error.message));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [id, uid, selectedSlide?.markdown, selectedIndex, presentation?.revision]);

  const srcDoc = useMemo(() => {
    if (!preview) return "";
    return `<!doctype html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;background:#f1f3f5;width:100%;height:100%}
      body{display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;overflow:hidden}
      ${preview.css}
      div.marpit{display:flex;align-items:center;justify-content:center;width:100%;height:100%;min-width:0;min-height:0}
      svg[data-marpit-svg]{display:block;flex:none;width:auto;height:auto;max-width:100%;max-height:100%}
      section{box-shadow:0 4px 20px rgba(0,0,0,.14)}
    </style></head><body>${preview.html}</body></html>`;
  }, [preview]);

  const saveCurrent = async () => {
    if (!presentation || !selectedSlide) return;
    setSaving(true);
    try {
      const state = orderDirty
        ? await replaceSlides(id, uid, presentation.revision, slides.map((slide) => slide.markdown))
        : await updateSlides(id, uid, presentation.revision, [{
            operation: "replace",
            slideIndex: selectedIndex + 1,
            markdown: selectedSlide.markdown,
          }]);
      applyState(state);
      editorControls.close();
      toast.success(orderDirty ? "Презентацію збережено" : "Слайд збережено");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не вдалося зберегти слайд.");
    } finally {
      setSaving(false);
    }
  };

  const saveOrder = async () => {
    if (!presentation) return;
    setSaving(true);
    try {
      applyState(await replaceSlides(id, uid, presentation.revision, slides.map((slide) => slide.markdown)));
      toast.success("Порядок слайдів збережено");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не вдалося зберегти порядок.");
    } finally {
      setSaving(false);
    }
  };

  if (!presentation || !selectedSlide) return <Center h={300}><Loader /></Center>;

  return (
    <>
      <Stack h="calc(100vh - 88px)" maw={1800} mx="auto" gap="sm">
        <Group justify="space-between">
          <Group>
            <Button component={Link} to={`/courses/${id}/presentations`} variant="subtle" px={0}>
              <FontAwesomeIcon icon={faArrowLeft} />
            </Button>
            <div>
              <Group gap="xs">
                <Title order={2}>{presentation.manifest.title}</Title>
                {presentation.dirty && <Badge color="orange">Зовнішні зміни</Badge>}
              </Group>
              <Text c="dimmed" size="sm">Версія {presentation.revision.slice(0, 12)}</Text>
            </div>
          </Group>
          <Group>
            <Button
              variant="default"
              leftSection={<FontAwesomeIcon icon={faList} />}
              onClick={slidesControls.open}
            >
              Слайди ({slides.length})
            </Button>
            <Button
              variant="default"
              leftSection={<FontAwesomeIcon icon={faClockRotateLeft} />}
              onClick={async () => {
                historyControls.open();
                try {
                  setHistory(await loadPresentationHistory(id, uid));
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Не вдалося завантажити історію.");
                }
              }}
            >
              Історія
            </Button>
            {orderDirty && <Button variant="light" onClick={saveOrder} loading={saving}>Зберегти порядок</Button>}
            <Button leftSection={<FontAwesomeIcon icon={faPen} />} onClick={editorControls.open}>
              Редагувати слайд
            </Button>
          </Group>
        </Group>

        <Paper withBorder p="sm" style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          {preview ? (
            <iframe
              title="Попередній перегляд слайда"
              sandbox=""
              srcDoc={srcDoc}
              style={{ width: "100%", height: "100%", border: 0, background: "#f1f3f5" }}
            />
          ) : (
            <Center h="100%"><Loader /></Center>
          )}
        </Paper>

        <Group justify="center" gap="md">
          <ActionIcon
            aria-label="Попередній слайд"
            variant="default"
            size="lg"
            disabled={selectedIndex === 0}
            onClick={() => setSelectedKey(slides[selectedIndex - 1]!.key)}
          >
            <FontAwesomeIcon icon={faChevronLeft} />
          </ActionIcon>
          <Text fw={600} miw={120} ta="center">
            {selectedIndex + 1} / {slides.length}
          </Text>
          <ActionIcon
            aria-label="Наступний слайд"
            variant="default"
            size="lg"
            disabled={selectedIndex === slides.length - 1}
            onClick={() => setSelectedKey(slides[selectedIndex + 1]!.key)}
          >
            <FontAwesomeIcon icon={faChevronRight} />
          </ActionIcon>
        </Group>
      </Stack>

      <Drawer
        opened={slidesOpened}
        onClose={slidesControls.close}
        title="Слайди презентації"
        position="left"
        size="sm"
      >
        <Stack gap="xs">
          <Group justify="space-between">
            <Text c="dimmed" size="sm">Перетягніть слайд за маркер, щоб змінити порядок.</Text>
            <Group gap={4} wrap="nowrap">
              <Tooltip label="Додати слайд">
                <ActionIcon
                  aria-label="Додати слайд"
                  variant="light"
                  onClick={() => {
                    const slide = { key: crypto.randomUUID(), markdown: "# Новий слайд" };
                    setSlides((current) => [...current, slide]);
                    setSelectedKey(slide.key);
                    setOrderDirty(true);
                  }}
                >
                  <FontAwesomeIcon icon={faPlus} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Видалити слайд">
                <ActionIcon
                  aria-label="Видалити слайд"
                  variant="light"
                  color="red"
                  disabled={slides.length === 1}
                  onClick={() => {
                    if (!confirm("Видалити цей слайд?")) return;
                    const next = slides.filter((slide) => slide.key !== selectedKey);
                    setSlides(next);
                    setSelectedKey(next[Math.min(selectedIndex, next.length - 1)]?.key ?? "");
                    setOrderDirty(true);
                  }}
                >
                  <FontAwesomeIcon icon={faTrash} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
          <Divider />
          <ScrollArea h="calc(100vh - 150px)" type="auto">
            <Reorder.Group
              axis="y"
              values={slides}
              onReorder={(next) => {
                setSlides(next);
                setOrderDirty(true);
              }}
              style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}
            >
              {slides.map((slide, index) => (
                <SlideItem
                  key={slide.key}
                  slide={slide}
                  index={index + 1}
                  selected={slide.key === selectedKey}
                  onSelect={() => {
                    setSelectedKey(slide.key);
                    slidesControls.close();
                  }}
                />
              ))}
            </Reorder.Group>
          </ScrollArea>
        </Stack>
      </Drawer>

      <Modal
        opened={editorOpened}
        onClose={editorControls.close}
        title={`Редагування слайда ${selectedIndex + 1}`}
        fullScreen
      >
        <Stack h="calc(100vh - 80px)" gap="sm">
          <Group justify="space-between">
            <Text fw={600}>{title(selectedSlide.markdown, selectedIndex + 1)}</Text>
            <Button leftSection={<FontAwesomeIcon icon={faSave} />} onClick={saveCurrent} loading={saving}>
              Зберегти слайд
            </Button>
          </Group>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(380px, 1fr) minmax(500px, 1fr)",
              gap: 16,
              flex: 1,
              minHeight: 0,
            }}
          >
            <Paper withBorder p="md" style={{ minHeight: 0 }}>
              <Textarea
                aria-label="Markdown слайда"
                value={selectedSlide.markdown}
                onChange={(event) => {
                  const markdown = event.currentTarget.value;
                  setSlides((current) => current.map((slide) => slide.key === selectedKey ? { ...slide, markdown } : slide));
                }}
                styles={{
                  root: { height: "100%" },
                  wrapper: { height: "100%" },
                  input: {
                    height: "100%",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: 14,
                  },
                }}
              />
            </Paper>
            <Paper withBorder p="sm" style={{ minHeight: 0, overflow: "hidden" }}>
              {preview ? (
                <iframe
                  title="Попередній перегляд редагованого слайда"
                  sandbox=""
                  srcDoc={srcDoc}
                  style={{ width: "100%", height: "100%", border: 0, background: "#f1f3f5" }}
                />
              ) : (
                <Center h="100%"><Loader /></Center>
              )}
            </Paper>
          </div>
        </Stack>
      </Modal>

      <Drawer opened={historyOpened} onClose={historyControls.close} title="Історія презентації" position="right" size="lg">
        <Stack>
          {history.map((entry, index) => (
            <Paper key={entry.revision} withBorder p="sm">
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <div>
                  <Group gap="xs">
                    {index === 0 && <Badge color="green">Поточна</Badge>}
                    <Text ff="monospace" size="sm">{entry.revision.slice(0, 12)}</Text>
                  </Group>
                  <Text size="sm">{entry.message}</Text>
                  <Text size="xs" c="dimmed">{new Date(entry.authoredAt).toLocaleString("uk-UA")}</Text>
                </div>
                <Tooltip label={index === 0 ? "Поточна версія" : "Відновити новим комітом"}>
                  <ActionIcon
                    aria-label={`Відновити версію ${entry.revision.slice(0, 12)}`}
                    variant="light"
                    disabled={index === 0}
                    onClick={async () => {
                      if (!confirm("Відновити презентацію до цієї версії?")) return;
                      try {
                        const restored = await restorePresentationRevision(
                          id,
                          uid,
                          presentation.revision,
                          entry.revision,
                        );
                        applyState(restored);
                        setHistory(await loadPresentationHistory(id, uid));
                        toast.success("Презентацію відновлено");
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Не вдалося відновити презентацію.");
                      }
                    }}
                  >
                    <FontAwesomeIcon icon={faRotateLeft} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Paper>
          ))}
        </Stack>
      </Drawer>
    </>
  );
}
