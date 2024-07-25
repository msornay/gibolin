"use client"

import { useForm } from "react-hook-form"

import { useParams } from 'react-router-dom';

import {
    QueryClient,
    QueryClientProvider,
    useMutation,
    useQuery,
} from'@tanstack/react-query'

import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"

import { Input } from "@/components/ui/input"


const formSchema = z.object({
    name: z.string(),
    domain: z.string(),
    vintage: z.coerce.number().positive(),
})

function ReferenceForm({ reference, onSubmit }) {
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
            defaultValues: reference,
    })

    /*
    const onSubmit = (data: z.infer<typeof formSchema>) => {
        console.log(data)
    }
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
    )
}

export function ReferenceDetails() {
    let { sqid } = useParams()

    console.log(sqid)

    if (sqid !== undefined) {
        const { data } = useQuery({
            queryKey: ['reference', sqid],
            queryFn: () =>
                fetch(`http://localhost:8000/api/ref/${sqid}`).then(
                    (res) => res.json()
                ),

        })
        const { register, handleSubmit } = useForm()
        const { mutate } = useMutation({
            mutationFn: (values) => updatReference(values),
        })


        if (data) {
            return <ReferenceForm reference={data} onSubmit={mutate} />
        } else {
            console.log("no data")
        }
    }
}
