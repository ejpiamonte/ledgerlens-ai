'use client';

import { Search } from 'lucide-react';

export type FilterOption = { value: string; label: string };
export type FilterSelect = { name: string; label: string; value: string; options: FilterOption[] };

/**
 * A plain GET form, so filters live in the URL (shareable, back-button friendly).
 * Selects apply immediately; search applies on Enter or the Search button.
 */
export function FilterBar({
  action,
  query,
  selects,
  placeholder = 'Search…',
}: {
  action: string;
  query: string;
  selects: FilterSelect[];
  placeholder?: string;
}) {
  return (
    <form className="filters" action={action} method="get" role="search">
      <input
        className="field search"
        type="search"
        name="q"
        defaultValue={query}
        placeholder={placeholder}
        aria-label="Search"
      />
      {selects.map((s) => (
        <select
          key={s.name}
          className="field"
          name={s.name}
          defaultValue={s.value}
          aria-label={s.label}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        >
          {s.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}
      <button className="btn" type="submit">
        <Search size={14} aria-hidden /> Search
      </button>
    </form>
  );
}
