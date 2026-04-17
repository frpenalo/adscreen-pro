import { useState, useRef, useEffect } from "react";
import { Loader2, MapPin } from "lucide-react";

interface Suggestion {
  display_name: string;
  lat: string;
  lon: string;
}

interface Props {
  value: string;
  onChange: (address: string, lat?: number, lng?: number) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

const AddressAutocomplete = ({ value, onChange, placeholder = "Escribe tu dirección...", required, className }: Props) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInput = (val: string) => {
    onChange(val);
    setOpen(false);
    setSuggestions([]);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.length < 4) return;

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&limit=5&countrycodes=us&addressdetails=1`;
        const res = await fetch(url, { headers: { "Accept-Language": "es" } });
        const data: Suggestion[] = await res.json();
        setSuggestions(data);
        setOpen(data.length > 0);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }, 600);
  };

  const handleSelect = (s: Suggestion) => {
    onChange(s.display_name, parseFloat(s.lat), parseFloat(s.lon));
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => handleInput(e.target.value)}
          placeholder={placeholder}
          required={required}
          className={className}
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-border rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {suggestions.map((s, i) => (
            <li
              key={i}
              onMouseDown={() => handleSelect(s)}
              className="flex items-start gap-2 px-3 py-2.5 cursor-pointer hover:bg-muted text-sm border-b border-border last:border-0"
            >
              <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <span className="text-foreground">{s.display_name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AddressAutocomplete;
