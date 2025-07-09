import React from "react";
import { useForm } from "react-hook-form";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PurchaseHistory } from "./purchase-history";

const formSchema = z.object({
  name: z.string(),
  category: z.string().optional(),
  domain: z.string().optional(),
  vintage: z.coerce.number().positive(),
});

type ReferenceFormProps = {
  reference: {
    name: string;
    category?: string;
    domain?: string;
    vintage: number;
  };
  onSubmit: (data: any) => void;
};

function ReferenceForm({ reference, onSubmit }: ReferenceFormProps) {
  const [newCategory, setNewCategory] = React.useState('');
  const [showNewCategoryInput, setShowNewCategoryInput] = React.useState(false);
  const [localCategories, setLocalCategories] = React.useState<string[]>([]);
  
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => 
      fetch('http://localhost:8000/api/categories').then(res => res.json()),
  });
  
  // Update local categories when API data changes
  React.useEffect(() => {
    if (categories) {
      setLocalCategories(categories);
    }
  }, [categories]);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: reference,
  });

  /*
   * XXX(msy) how to benefit from zod validation with react query mutate?
   * const onSubmit = (data: z.infer<typeof formSchema>) => {
   *     console.log(data)
   * }
   */

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <div className="space-y-2">
                {!showNewCategoryInput ? (
                  <div className="flex space-x-2">
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {localCategories.map((category: string) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowNewCategoryInput(true)}
                    >
                      +
                    </Button>
                  </div>
                ) : (
                  <div className="flex space-x-2">
                    <FormControl>
                      <Input
                        placeholder="New category"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (newCategory.trim()) {
                          const trimmedCategory = newCategory.trim();
                          // Add to local categories if not already present
                          if (!localCategories.includes(trimmedCategory)) {
                            setLocalCategories(prev => [...prev, trimmedCategory].sort());
                          }
                          field.onChange(trimmedCategory);
                          setNewCategory('');
                          setShowNewCategoryInput(false);
                        }
                      }}
                    >
                      Add
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowNewCategoryInput(false);
                        setNewCategory('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="domain"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Domain</FormLabel>
              <FormControl>
                <Input placeholder="Domain" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="vintage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Vintage</FormLabel>
              <FormControl>
                <Input placeholder="Vintage" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}

import { Reference } from "../index";

type ReferenceDetailsProps = {
  reference: Reference | null;
  onClose: () => void;
};

export function ReferenceDetails({ reference, onClose }: ReferenceDetailsProps) {
  const queryClient = useQueryClient();
  
  const { data } = useQuery({
    queryKey: ["reference", reference?.sqid],
    queryFn: () =>
      fetch(`http://localhost:8000/api/ref/${reference?.sqid}`).then((res) =>
        res.json(),
      ),
    enabled: reference !== null,
    staleTime: Infinity,
  });

  const { mutate: updateMutate } = useMutation({
    mutationFn: (values) =>
      fetch(`http://localhost:8000/api/ref/${reference?.sqid}`, {
        method: "PUT",
        body: JSON.stringify(values),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["references"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      onClose();
    },
  });

  const { mutate: createMutate } = useMutation({
    mutationFn: (values) =>
      fetch(`http://localhost:8000/api/ref`, {
        method: "POST",
        body: JSON.stringify(values),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["references"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      onClose();
    },
  });

  if (reference !== null) {
    if (data) {
      return (
        <div className="space-y-6">
          <ReferenceForm reference={data} onSubmit={updateMutate} />
          <PurchaseHistory 
            referenceId={reference.sqid} 
            purchases={data.purchases || []} 
          />
        </div>
      );
    }
    return <div>Loading...</div>;
  }

  return (
    <ReferenceForm
      reference={{
        name: "",
        category: "",
        domain: "",
        vintage: 2023,
      }}
      onSubmit={createMutate}
    />
  );
}
