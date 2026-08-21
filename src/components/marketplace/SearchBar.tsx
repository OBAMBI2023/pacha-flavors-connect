import { Search } from "lucide-react";

export function SearchBar({
  value,
  onChange,
  placeholder = "Recherche dans Restaurants",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex h-16 items-center gap-3 rounded-full border border-border bg-muted px-5">
      <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-full w-full bg-transparent text-lg outline-none placeholder:text-muted-foreground"
      />
    </label>
  );
}
