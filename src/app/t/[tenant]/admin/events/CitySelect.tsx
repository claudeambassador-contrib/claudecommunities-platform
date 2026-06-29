"use client";

import { useCities } from "@/components/CitiesProvider";
import { capitalCities, regionalCities } from "@/lib/cities";

export default function CitySelect({
  value,
  onChange,
  disabled = false,
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  const cities = useCities();
  const capitals = capitalCities(cities);
  const regionals = regionalCities(cities);
  return (
    <select
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full px-4 py-2 bg-[#1a1a1a] border border-[#333] rounded-lg text-white focus:outline-none focus:border-[#E07A5F] disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <option value="">Select city</option>
      {disabled && <option value="Online">Online</option>}
      <optgroup label="Capital Cities">
        {capitals.map((city) => (
          <option key={city.slug} value={city.name}>
            {city.name}, {city.state}
          </option>
        ))}
      </optgroup>
      <optgroup label="Regional Cities">
        {regionals.map((city) => (
          <option key={city.slug} value={city.name}>
            {city.name}, {city.state}
          </option>
        ))}
      </optgroup>
    </select>
  );
}
