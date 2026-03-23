import React from "react";
import { Select } from "antd";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { API_BASE_URL, apiFetch } from "@/api";

const CREATE_PREFIX = "__create__";

type CreatableSelectProps = {
  options: string[];
  createEndpoint: string;
  queryKey: string;
  placeholder: string;
  value?: string;
  onChange?: (value: string | undefined) => void;
  allowClear?: boolean;
};

export function CreatableSelect({
  options,
  createEndpoint,
  queryKey,
  placeholder,
  value,
  onChange,
  allowClear = true,
}: CreatableSelectProps) {
  const [searchValue, setSearchValue] = React.useState("");
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (name: string) =>
      apiFetch(`${API_BASE_URL}${createEndpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
  });

  const filtered = (options || [])
    .filter(
      (opt) =>
        !searchValue ||
        opt.toLowerCase().includes(searchValue.toLowerCase()),
    )
    .map((opt) => ({ value: opt, label: opt }));

  const noExactMatch =
    searchValue.trim() &&
    !options.some(
      (opt) => opt.toLowerCase() === searchValue.trim().toLowerCase(),
    );

  const selectOptions = noExactMatch
    ? [
        {
          value: `${CREATE_PREFIX}${searchValue.trim()}`,
          label: `Create "${searchValue.trim()}"`,
        },
        ...filtered,
      ]
    : filtered;

  const handleSelect = (selected: string) => {
    if (selected.startsWith(CREATE_PREFIX)) {
      const name = selected.slice(CREATE_PREFIX.length);
      createMutation.mutate(name, {
        onSuccess: () => {
          onChange?.(name);
          setSearchValue("");
        },
      });
    } else {
      onChange?.(selected);
      setSearchValue("");
    }
  };

  return (
    <Select
      showSearch
      allowClear={allowClear}
      placeholder={placeholder}
      value={value}
      searchValue={searchValue}
      onSearch={setSearchValue}
      onSelect={handleSelect}
      onClear={() => onChange?.(undefined)}
      filterOption={false}
      options={selectOptions}
      loading={createMutation.isPending}
    />
  );
}
