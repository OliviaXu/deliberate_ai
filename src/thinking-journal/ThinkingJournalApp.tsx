import { useEffect, useMemo, useState } from 'react';
import { loadThinkingJournalEntries } from './thinking-journal-store';
import { filterThinkingJournalEntries, type ThinkingJournalEntry, type ThinkingJournalFilter } from './utils/entries';

interface ThinkingJournalAppProps {
  preloadedEntries?: ThinkingJournalEntry[];
}

const FILTERS: Array<{ value: ThinkingJournalFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'problem_solving', label: 'Problem-Solving' },
  { value: 'delegation', label: 'Delegation' },
  { value: 'learning', label: 'Learning' }
];

export function ThinkingJournalApp({ preloadedEntries }: ThinkingJournalAppProps): JSX.Element {
  const [entries, setEntries] = useState<ThinkingJournalEntry[]>(preloadedEntries ?? []);
  const [filter, setFilter] = useState<ThinkingJournalFilter>('all');
  const [expandedPromptIds, setExpandedPromptIds] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(preloadedEntries === undefined);

  useEffect(() => {
    if (preloadedEntries !== undefined) return;
    let active = true;

    void loadThinkingJournalEntries()
      .then((nextEntries) => {
        if (!active) return;
        setEntries(nextEntries);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [preloadedEntries]);

  const filteredEntries = useMemo(() => filterThinkingJournalEntries(entries, filter), [entries, filter]);

  return (
    <main className="mx-auto max-w-[860px] px-5 pb-14 pt-10 sm:px-3.5 sm:pb-11 sm:pt-7">
      <header>
        <h1 className="m-0 text-[clamp(1.85rem,2.7vw,2.35rem)] font-semibold tracking-[-0.02em]">Thinking Journal</h1>
        <p className="mt-2.5 text-[0.98rem] text-[#566271]">A quiet view of your thinking.</p>
      </header>

      <section className="mt-[26px] flex flex-wrap gap-2.5" aria-label="Thinking Journal filters">
        {FILTERS.map((item) => (
          <button
            type="button"
            key={item.value}
            className={`appearance-none cursor-pointer rounded-[15px] border px-3 py-2 text-[0.9rem] font-medium leading-none shadow-none transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(59,130,246,0.38)] ${
              item.value === filter
                ? 'border-[rgba(15,23,42,0.14)] bg-[#f6f7f9] text-[#202124]'
                : 'border-[rgba(15,23,42,0.14)] bg-white text-[#2c3136] hover:bg-[#f6f7f9]'
            }`}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </section>

      <section className="mt-7 grid gap-[18px]" aria-live="polite">
        {loading && <p className="mt-2 text-[#6a7786]">Loading entries...</p>}
        {!loading && filteredEntries.length === 0 && <p className="mt-2 text-[#6a7786]">No entries in the last 7 days.</p>}
        {!loading &&
          filteredEntries.map((entry) => {
            const isExpanded = Boolean(expandedPromptIds[entry.id]);
            return (
              <article
                key={entry.id}
                className="rounded-[14px] border border-[#dce2e8] bg-white p-[18px]"
                data-testid="thinking-journal-card"
              >
                <div className="flex flex-wrap items-center justify-between gap-3.5">
                  <p className="m-0 text-[0.9rem] text-[#5f6b7a]">{entry.dateLabel}</p>
                  <span className="whitespace-nowrap rounded-full border border-[#d7e1ee] bg-[#f2f6fb] px-2.5 py-1.5 text-[0.84rem] text-[#2f4257]">
                    {entry.modeEmoji} {entry.modeLabel}
                  </span>
                </div>

                <section className="mt-4">
                  <h2 className="mb-[7px] mt-0 text-[0.8rem] font-semibold uppercase tracking-[0.06em] text-[#6a7786]">Prompt</h2>
                  <p
                    className={`m-0 whitespace-pre-wrap leading-[1.6] text-[#213040] ${
                      entry.promptIsLong && !isExpanded
                        ? '[display:-webkit-box] overflow-hidden [-webkit-box-orient:vertical] [-webkit-line-clamp:3]'
                        : ''
                    }`}
                  >
                    {entry.prompt}
                  </p>
                  {entry.promptIsLong && (
                    <button
                      type="button"
                      className="mt-2 cursor-pointer border-0 bg-transparent p-0 text-[0.88rem] text-[#52657e]"
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
                </section>

                {entry.mode === 'problem_solving' && (
                  <section className="mt-4">
                    <h2 className="mb-[7px] mt-0 text-[0.8rem] font-semibold uppercase tracking-[0.06em] text-[#6a7786]">
                      Your Hypothesis
                    </h2>
                    <p className="m-0 whitespace-pre-wrap leading-[1.6] text-[#213040]">{entry.hypothesis}</p>
                  </section>
                )}

                {entry.mode === 'learning' && entry.initialContext && (
                  <section className="mt-4">
                    <h2 className="mb-[7px] mt-0 text-[0.8rem] font-semibold uppercase tracking-[0.06em] text-[#6a7786]">
                      Initial Context
                    </h2>
                    <p className="m-0 whitespace-pre-wrap leading-[1.6] text-[#213040]">{entry.initialContext}</p>
                  </section>
                )}
              </article>
            );
          })}
      </section>
    </main>
  );
}
