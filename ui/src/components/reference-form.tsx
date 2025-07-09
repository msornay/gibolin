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

const formSchema = z.object({
  name: z.string(),
  domain: z.string(),
  vintage: z.coerce.number().positive(),
});

type ReferenceFormProps = {
  reference: {
    name: string;
    domain: string;
    vintage: number;
  };
  onSubmit: (data: any) => void;
};

function ReferenceForm({ reference, onSubmit }: ReferenceFormProps) {
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

type ReferenceDetailsProps = {
  reference: { sqid: string; name: string; domain: string; vintage: number } | null;
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
      onClose();
    },
  });

  if (reference !== null) {
    if (data) {
      return <ReferenceForm reference={data} onSubmit={updateMutate} />;
    }
    return <div>Loading...</div>;
  }

  return (
    <ReferenceForm
      reference={{
        name: "",
        domain: "",
        vintage: 2023,
      }}
      onSubmit={createMutate}
    />
  );
}
