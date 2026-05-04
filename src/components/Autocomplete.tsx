import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../utils';

interface AutocompleteProps {
  table: string;
  column: string;
  placeholder?: string;
  onSelect: (value: string, item?: any) => void;
  className?: string;
  defaultValue?: string;
  inputClassName?: string;
}

export default function Autocomplete({ table, column, placeholder, onSelect, className, defaultValue = '', inputClassName }: AutocompleteProps) {
  const [query, setQuery] = useState(defaultValue);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (defaultValue !== undefined) {
      setQuery(defaultValue);
    }
  }, [defaultValue]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim().length < 1) {
      setResults([]);
      return;
    }

    const fetchResults = async () => {
      setLoading(true);
      try {
        let dbQuery = supabase.from(table).select('*');
        
        if (table === 'vehicles') {
          // Check for prefix, plate or model
          dbQuery = dbQuery.or(`plate.ilike.%${query}%,model.ilike.%${query}%,prefix.ilike.%${query}%`);
        } else if (table === 'profiles') {
          // Check for name, email or cpf
          dbQuery = dbQuery.or(`name.ilike.%${query}%,email.ilike.%${query}%,cpf.ilike.%${query}%`);
        } else {
          dbQuery = dbQuery.ilike(column, `%${query}%`);
        }

        const { data, error } = await dbQuery.limit(8);

        if (error) throw error;
        setResults(data || []);
      } catch (err) {
        console.error('Error fetching autocomplete results:', err);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchResults, 300);
    return () => clearTimeout(debounce);
  }, [query, table, column]);

  const handleSelect = (item: any) => {
    const value = item[column];
    setQuery(value);
    setIsOpen(false);
    onSelect(value, item);
  };

  return (
    <div className={cn("relative w-full", className)} ref={dropdownRef}>
      <div className="relative">
        <input
          type="text"
          className={cn("input-field pl-10 pr-10", inputClassName)}
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            const val = e.target.value;
            setQuery(val);
            setIsOpen(true);
            // We only call onSelect when typing if we want real-time local filtering to still work
            // But usually for autocomplete we wait for the selection or use the query.
            onSelect(val); 
          }}
          onFocus={() => {
            if (query.length >= 1) setIsOpen(true);
          }}
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {loading && <Loader2 className="text-primary animate-spin" size={16} />}
          {query && (
            <button 
              type="button"
              onClick={() => { setQuery(''); onSelect(''); setIsOpen(false); }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-[100] w-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
          <div className="max-h-60 overflow-y-auto">
            {results.map((item, index) => (
              <button
                key={item.id || index}
                type="button"
                className="w-full px-4 py-3 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex flex-col border-b border-slate-100 dark:border-slate-800 last:border-0"
                onClick={() => handleSelect(item)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold dark:text-white">
                    {table === 'vehicles' ? `${item.plate}` : (item.name || item[column])}
                  </span>
                  {table === 'vehicles' && (
                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase">
                      {item.prefix}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {table === 'vehicles' && (
                    <span className="text-xs text-slate-500">{item.model}</span>
                  )}
                  {table === 'profiles' && (
                    <span className="text-xs text-slate-500">{item.cpf || item.email}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
