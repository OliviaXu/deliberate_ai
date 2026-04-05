import { useEffect, useMemo, useState } from 'react';
import { INTERACTION_MODES, type ReflectionScore } from '../shared/types';
import { loadRecentThinkingJournalEntries, loadThinkingJournalExportRows } from './thinking-journal-store';
import { buildThinkingJournalExportCsv, buildThinkingJournalExportFilename } from './utils/export';
import {
  buildThinkingJournalEntryViews,
  filterThinkingJournalEntryViews,
  type ThinkingJournalEntryView,
  type ThinkingJournalEntryViewFilter
} from './utils/entry-view';
import type { ThinkingJournalEntryRecord } from './utils/history';

interface ThinkingJournalAppProps {
  preloadedEntries?: ThinkingJournalEntryView[];
  loadRecentEntries?: () => Promise<ThinkingJournalEntryRecord[]>;
  loadExportRows?: () => Promise<ThinkingJournalEntryRecord[]>;
}

const FILTERS: Array<{ value: ThinkingJournalEntryViewFilter; label: string; emoji?: string }> = [
  { value: 'all', label: 'All' },
  { value: INTERACTION_MODES.PROBLEM_SOLVING, label: 'Problem-Solving', emoji: '🤔' },
  { value: INTERACTION_MODES.DELEGATION, label: 'Delegation', emoji: '😌' },
  { value: INTERACTION_MODES.LEARNING, label: 'Learning', emoji: '🧑‍🎓' }
];

type ReflectionVisualLevel = 1 | 2 | 3 | 4 | 5;

const NAV_CHIP_BASE_CLASS =
  'group font-journal appearance-none cursor-pointer rounded-[15px] border px-3 py-[0.55rem] text-[0.92rem] font-semibold leading-none transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(59,130,246,0.38)]';

const NAV_CHIP_SELECTED_CLASS = 'border-transparent bg-white text-[#2f4257]';

const NAV_CHIP_UNSELECTED_CLASS =
  'border-transparent bg-transparent text-[#6f6963] hover:bg-white hover:text-[#2f4257]';

const CHIP_CONTENT_CLASS = 'inline-flex items-center gap-1.5';

const CHIP_EMOJI_CLASS =
  'text-[0.88rem] leading-none opacity-95 [filter:grayscale(0.45)_saturate(0.55)] group-hover:[filter:none]';

const CHIP_EMOJI_SELECTED_CLASS = 'text-[0.88rem] leading-none opacity-100 [filter:none]';

const METADATA_TAG_CLASS =
  'whitespace-nowrap rounded-[15px] bg-[#f7f9fb] px-3 py-[0.55rem] text-[0.92rem] font-medium leading-none text-[#5f7182]';

export function ThinkingJournalApp({
  preloadedEntries,
  loadRecentEntries = loadRecentThinkingJournalEntries,
  loadExportRows = loadThinkingJournalExportRows
}: ThinkingJournalAppProps): JSX.Element {
  const [entryRecords, setEntryRecords] = useState<ThinkingJournalEntryRecord[]>([]);
  const [filter, setFilter] = useState<ThinkingJournalEntryViewFilter>('all');
  const [withReflectionOnly, setWithReflectionOnly] = useState(false);
  const [expandedPromptIds, setExpandedPromptIds] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(preloadedEntries === undefined);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (preloadedEntries !== undefined) return;
    let active = true;

    void loadRecentEntries()
      .then((nextEntryRecords) => {
        if (!active) return;
        setEntryRecords(nextEntryRecords);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loadRecentEntries, preloadedEntries]);

  const entryViews = useMemo(
    () => preloadedEntries ?? buildThinkingJournalEntryViews(entryRecords),
    [entryRecords, preloadedEntries]
  );

  const filteredEntryViews = useMemo(
    () =>
      filterThinkingJournalEntryViews(entryViews, {
        mode: filter,
        withReflectionOnly
      }),
    [entryViews, filter, withReflectionOnly]
  );
  const showExportAction = !loading && filter === 'all' && !withReflectionOnly;

  return (
    <main className="mx-auto max-w-[860px] px-5 pb-10 pt-8 font-journal sm:px-3.5 sm:pb-9 sm:pt-6">
      <header>
        <h1 className="m-0 text-[clamp(1.85rem,2.7vw,2.35rem)] font-semibold tracking-[-0.02em]">Thinking Journal</h1>
        <p className="mt-1.5 text-[0.95rem] text-[#5d6977]">A quiet view of your thinking</p>
      </header>

      <section className="mt-4 border-b border-[#e3e8ee] pb-2.5" aria-label="Thinking Journal filters">
        <div className="flex flex-wrap items-center justify-between gap-2.5" data-testid="thinking-journal-filter-groups">
          <div className="flex flex-wrap items-center gap-2.5">
            {FILTERS.map((item) => {
              const isSelected = item.value === filter;
              return (
                <button
                  type="button"
                  key={item.value}
                  className={`${NAV_CHIP_BASE_CLASS} ${isSelected ? NAV_CHIP_SELECTED_CLASS : NAV_CHIP_UNSELECTED_CLASS}`}
                  onClick={() => setFilter(item.value)}
                >
                  {item.emoji ? (
                    <span className={CHIP_CONTENT_CLASS}>
                      <span
                        className={
                          isSelected
                            ? CHIP_EMOJI_SELECTED_CLASS
                            : CHIP_EMOJI_CLASS
                        }
                        data-testid={`thinking-journal-filter-emoji-${item.value}`}
                      >
                        {item.emoji}
                      </span>
                      <span>{item.label}</span>
                    </span>
                  ) : (
                    item.label
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex items-center md:ml-auto">
            <button
              type="button"
              className={`${NAV_CHIP_BASE_CLASS} ${withReflectionOnly ? NAV_CHIP_SELECTED_CLASS : NAV_CHIP_UNSELECTED_CLASS}`}
              aria-pressed={withReflectionOnly}
              onClick={() => setWithReflectionOnly((current) => !current)}
            >
              With reflection
            </button>
          </div>
        </div>
      </section>

      <section className="mt-3 grid gap-2.5" aria-live="polite">
        {loading && <p className="mt-2 text-[#6a7786]">Loading entries...</p>}
        {!loading && filteredEntryViews.length === 0 && <p className="mt-2 text-[#6a7786]">No entries in the last 7 days.</p>}
        {!loading &&
          filteredEntryViews.map((entry) => {
            const isExpanded = Boolean(expandedPromptIds[entry.id]);
            const supportingContent = (
              <>
                {entry.mode === INTERACTION_MODES.PROBLEM_SOLVING && (
                  <section>
                    <h2 className="mb-1 mt-0 text-[0.74rem] font-medium tracking-[0.01em] text-[#7a8795]">
                      Your Hypothesis
                    </h2>
                    <p className="m-0 whitespace-pre-wrap leading-[1.6] text-[#213040]">{entry.hypothesis}</p>
                  </section>
                )}

                {entry.mode === INTERACTION_MODES.LEARNING && entry.initialContext && (
                  <section>
                    <h2 className="mb-1 mt-0 text-[0.74rem] font-medium tracking-[0.01em] text-[#7a8795]">
                      Starting Point
                    </h2>
                    <p className="m-0 whitespace-pre-wrap leading-[1.6] text-[#213040]">{entry.initialContext}</p>
                  </section>
                )}
              </>
            );
            const hasSupportingContent =
              entry.mode === INTERACTION_MODES.PROBLEM_SOLVING ||
              (entry.mode === INTERACTION_MODES.LEARNING && Boolean(entry.initialContext));
            const hasBody = hasSupportingContent || Boolean(entry.reflection);

            return (
              <article
                key={entry.id}
                className="rounded-[14px] border border-[#dce2e8] bg-white p-2.5"
                data-testid="thinking-journal-card"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center justify-between gap-2.5" data-testid="thinking-journal-card-header">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <p className="m-0 shrink-0 text-[1rem] text-[#707b88]" data-testid="thinking-journal-date-title">
                          {entry.dateLabel}
                        </p>
                        <p
                          className={`m-0 min-w-0 whitespace-pre-wrap text-[1rem] leading-[1.45] text-[#213040] ${
                            entry.promptIsLong && !isExpanded
                              ? '[display:-webkit-box] overflow-hidden [-webkit-box-orient:vertical] [-webkit-line-clamp:2]'
                              : ''
                          }`}
                          data-testid="thinking-journal-prompt-title"
                        >
                          {entry.prompt}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5" data-testid="thinking-journal-card-badge-group">
                      {entry.reflection ? <ReflectionSpark level={toReflectionVisualLevel(entry.reflection.score)} /> : null}
                      <span className={METADATA_TAG_CLASS} data-testid="thinking-journal-card-mode-badge">
                        <span className={CHIP_CONTENT_CLASS}>
                          <span className={CHIP_EMOJI_SELECTED_CLASS} data-testid="thinking-journal-card-mode-badge-emoji">
                            {entry.modeEmoji}
                          </span>
                          <span data-testid="thinking-journal-card-mode-badge-label">{entry.modeLabel}</span>
                        </span>
                      </span>
                    </span>
                  </div>
                  {entry.promptIsLong && (
                    <button
                      type="button"
                      className="w-fit cursor-pointer border-0 bg-transparent p-0 text-[0.88rem] text-[#52657e]"
                      onClick={() =>
                        setExpandedPromptIds((current) => ({
                          ...current,
                          [entry.id]: !current[entry.id]
                        }))
                      }
                    >
                      {isExpanded ? 'Show less' : 'Show more'}
                    </button>
                  )}
                </div>

                {hasBody &&
                  (entry.reflection ? (
                  <div
                    className="mt-2 grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.88fr)] md:items-start"
                    data-testid="thinking-journal-card-columns"
                  >
                    <div className="grid gap-2" data-testid="thinking-journal-supporting-column">
                      {hasSupportingContent ? supportingContent : null}
                    </div>
                    <section
                      className="border-t border-[#edf1f4] pt-2 md:border-l md:border-t-0 md:pl-3 md:pt-0"
                      data-testid="thinking-journal-reflection"
                    >
                      <h2
                        className="mb-1 mt-0 text-[0.74rem] font-medium tracking-[0.01em] text-[#7a8795]"
                        data-testid="thinking-journal-reflection-header"
                      >
                        Reflection
                      </h2>
                      {entry.reflection.notes && (
                        <p
                          className="m-0 whitespace-pre-wrap leading-[1.6] text-[#213040]"
                          data-testid="thinking-journal-reflection-notes"
                        >
                          {entry.reflection.notes}
                        </p>
                      )}
                    </section>
                  </div>
                ) : (
                  <div className="mt-2 grid gap-2">{supportingContent}</div>
                ))}
              </article>
            );
          })}
        {showExportAction && (
          <div className="mt-5 flex flex-col items-center gap-2.5 pt-4 text-center" data-testid="thinking-journal-export-footer">
            <button
              type="button"
              className="cursor-pointer border-0 bg-transparent p-0 text-[0.9rem] text-[#9aa4af] transition-colors duration-100 hover:text-[#71808f] disabled:cursor-default disabled:text-[#9aa4af]"
              onClick={() => void handleExportClick(loadExportRows, setIsExporting)}
              disabled={isExporting}
            >
              Download full history as CSV
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

async function handleExportClick(
  loadExportRows: () => Promise<ThinkingJournalEntryRecord[]>,
  setIsExporting: React.Dispatch<React.SetStateAction<boolean>>
): Promise<void> {
  setIsExporting(true);

  try {
    const rows = await loadExportRows();
    const csv = buildThinkingJournalExportCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = buildThinkingJournalExportFilename();
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  } finally {
    setIsExporting(false);
  }
}

function toReflectionVisualLevel(score: ReflectionScore): ReflectionVisualLevel {
  if (score <= 0) return 1;
  if (score <= 25) return 2;
  if (score <= 50) return 3;
  if (score <= 75) return 4;
  return 5;
}

function ReflectionSpark({ level }: { level: ReflectionVisualLevel }): JSX.Element {
  const styles = sparkStyles(level);

  return (
    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center" data-testid="thinking-journal-reflection-spark" data-level={level}>
      <svg width="19" height="19" viewBox="0 0 20 20" aria-hidden="true">
        {styles.glowOpacity > 0 && (
          <circle cx="10" cy="10" r="6.2" fill={styles.glowColor} opacity={styles.glowOpacity} />
        )}
        <path
          d="M10 2.8L11.82 8.18L17.2 10L11.82 11.82L10 17.2L8.18 11.82L2.8 10L8.18 8.18L10 2.8Z"
          fill={styles.fillColor}
          fillOpacity={styles.fillOpacity}
          stroke={styles.strokeColor}
          strokeOpacity={styles.strokeOpacity}
          strokeWidth="1.15"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function sparkStyles(level: ReflectionVisualLevel): {
  fillColor: string;
  fillOpacity: number;
  strokeColor: string;
  strokeOpacity: number;
  glowColor: string;
  glowOpacity: number;
} {
  switch (level) {
    case 1:
      return {
        fillColor: '#e0ad5f',
        fillOpacity: 0,
        strokeColor: '#c08d45',
        strokeOpacity: 0.82,
        glowColor: '#eac88c',
        glowOpacity: 0
      };
    case 2:
      return {
        fillColor: '#e2ad5c',
        fillOpacity: 0.08,
        strokeColor: '#c98e3b',
        strokeOpacity: 0.98,
        glowColor: '#efcf96',
        glowOpacity: 0.12
      };
    case 3:
      return {
        fillColor: '#dfaa56',
        fillOpacity: 0.52,
        strokeColor: '#c7862e',
        strokeOpacity: 0.98,
        glowColor: '#e9c37f',
        glowOpacity: 0.08
      };
    case 4:
      return {
        fillColor: '#d4973c',
        fillOpacity: 0.72,
        strokeColor: '#b7761f',
        strokeOpacity: 1,
        glowColor: '#e0b86d',
        glowOpacity: 0.14
      };
    case 5:
      return {
        fillColor: '#cb8928',
        fillOpacity: 0.84,
        strokeColor: '#aa6915',
        strokeOpacity: 1,
        glowColor: '#dfb366',
        glowOpacity: 0.2
      };
  }
}
