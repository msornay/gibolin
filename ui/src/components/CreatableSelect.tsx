import React from "react";
import { Select } from "antd";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { API_BASE_URL, apiFetch } from "@/api";

const CREATE_PREFIX = "__create__";

type SingleProps = {
  mode?: undefined;
  value?: string;
  onChange?: (value: string | undefined) => void;
};

type MultipleProps = {
  mode: "multiple";
  value?: string[];
  onChange?: (value: string[]) => void;
};

type CreatableSelectProps = {
  options: string[];
  createEndpoint: string;
  queryKey: string;
  placeholder: string;
  allowClear?: boolean;
} & (SingleProps | MultipleProps);

export function CreatableSelect(props: CreatableSelectProps) {
  const {
    options,
    createEndpoint,
    queryKey,
    placeholder,
    value,
    onChange,
    allowClear = true,
    mode,
  } = props;

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
          if (mode === "multiple") {
            const current = (value as string[]) || [];
            (onChange as (v: string[]) => void)?.([...current, name]);
          } else {
            (onChange as (v: string | undefined) => void)?.(name);
          }
          setSearchValue("");
        },
      });
    } else {
      if (mode !== "multiple") {
        (onChange as (v: string | undefined) => void)?.(selected);
      }
      setSearchValue("");
    }
  };

  return (
    <Select
      showSearch
      allowClear={allowClear}
      placeholder={placeholder}
      value={value as string & string[]}
      searchValue={searchValue}
      onSearch={setSearchValue}
      onSelect={handleSelect}
      onClear={() => {
        if (mode === "multiple") {
          (onChange as (v: string[]) => void)?.([]);
        } else {
          (onChange as (v: string | undefined) => void)?.(undefined);
        }
      }}
      filterOption={false}
      options={selectOptions}
      loading={createMutation.isPending}
      mode={mode}
      onChange={mode === "multiple" ? (onChange as (v: string[]) => void) : undefined}
    />
  );
}
