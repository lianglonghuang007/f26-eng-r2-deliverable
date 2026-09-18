"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { createBrowserSupabaseClient } from "@/lib/client-utils";
import type { Database } from "@/lib/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type BaseSyntheticEvent } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

type Species = Database["public"]["Tables"]["species"]["Row"];

const kingdoms = z.enum(["Animalia", "Plantae", "Fungi", "Protista", "Archaea", "Bacteria"]);

const speciesSchema = z.object({
  scientific_name: z
    .string()
    .trim()
    .min(1)
    .transform((val) => val.trim()),
  common_name: z
    .string()
    .nullable()
    .transform((val) => (!val || val.trim() === "" ? null : val.trim())),
  kingdom: kingdoms,
  total_population: z.number().int().positive().min(1).nullable(),
  image: z
    .string()
    .url()
    .nullable()
    .transform((val) => (!val || val.trim() === "" ? null : val.trim())),
  description: z
    .string()
    .nullable()
    .transform((val) => (!val || val.trim() === "" ? null : val.trim())),
});

type FormData = z.infer<typeof speciesSchema>;

export default function SpeciesCard({ species, userId }: { species: Species; userId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // The current user may only edit species they authored
  const isAuthor = species.author === userId;

  // Pre-fill the form with this species' existing values
  const defaultValues: FormData = {
    scientific_name: species.scientific_name,
    common_name: species.common_name,
    kingdom: species.kingdom,
    total_population: species.total_population,
    image: species.image,
    description: species.description,
  };

  const form = useForm<FormData>({
    resolver: zodResolver(speciesSchema),
    defaultValues,
    mode: "onChange",
  });

  const onSubmit = async (input: FormData) => {
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase
      .from("species")
      .update({
        common_name: input.common_name,
        description: input.description,
        kingdom: input.kingdom,
        scientific_name: input.scientific_name,
        total_population: input.total_population,
        image: input.image,
      })
      .eq("id", species.id);

    if (error) {
      return toast({
        title: "Something went wrong.",
        description: error.message,
        variant: "destructive",
      });
    }

    setIsEditing(false);
    setOpen(false);
    router.refresh();

    return toast({
      title: "Species updated!",
      description: "Successfully updated " + input.scientific_name + ".",
    });
  };

  // When the user cancels an edit, discard changes by resetting to original values
  const handleCancel = () => {
    form.reset(defaultValues);
    setIsEditing(false);
  };

  return (
    <div className="m-4 w-72 min-w-72 flex-none rounded border-2 p-3 shadow">
      {species.image && (
        <div className="relative h-40 w-full">
          <Image src={species.image} alt={species.scientific_name} fill style={{ objectFit: "cover" }} />
        </div>
      )}
      <h3 className="mt-3 text-2xl font-semibold">{species.scientific_name}</h3>
      <h4 className="text-lg font-light italic">{species.common_name}</h4>
      <p>{species.description ? species.description.slice(0, 150).trim() + "..." : ""}</p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="mt-3 w-full">Learn More</Button>
        </DialogTrigger>
        <DialogContent className="max-h-screen overflow-y-auto sm:max-w-[600px]">
          {isEditing ? (
            <>
              <DialogHeader>
                <DialogTitle>Edit Species</DialogTitle>
                <DialogDescription>Make changes below, then click &quot;Save changes&quot;.</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={(e: BaseSyntheticEvent) => void form.handleSubmit(onSubmit)(e)}>
                  <div className="grid w-full items-center gap-4">
                    <FormField
                      control={form.control}
                      name="scientific_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Scientific Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Cavia porcellus" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="common_name"
                      render={({ field }) => {
                        const { value, ...rest } = field;
                        return (
                          <FormItem>
                            <FormLabel>Common Name</FormLabel>
                            <FormControl>
                              <Input value={value ?? ""} placeholder="Guinea pig" {...rest} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                    <FormField
                      control={form.control}
                      name="kingdom"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Kingdom</FormLabel>
                          <Select onValueChange={(value) => field.onChange(kingdoms.parse(value))} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a kingdom" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectGroup>
                                {kingdoms.options.map((kingdom, index) => (
                                  <SelectItem key={index} value={kingdom}>
                                    {kingdom}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="total_population"
                      render={({ field }) => {
                        const { value, ...rest } = field;
                        return (
                          <FormItem>
                            <FormLabel>Total population</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                value={value ?? ""}
                                placeholder="300000"
                                {...rest}
                                onChange={(event) => field.onChange(+event.target.value)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                    <FormField
                      control={form.control}
                      name="image"
                      render={({ field }) => {
                        const { value, ...rest } = field;
                        return (
                          <FormItem>
                            <FormLabel>Image URL</FormLabel>
                            <FormControl>
                              <Input value={value ?? ""} placeholder="https://..." {...rest} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => {
                        const { value, ...rest } = field;
                        return (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea value={value ?? ""} placeholder="Description..." {...rest} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                    <div className="flex">
                      <Button type="submit" className="ml-1 mr-1 flex-auto">
                        Save changes
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="ml-1 mr-1 flex-auto"
                        onClick={handleCancel}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </form>
              </Form>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{species.scientific_name}</DialogTitle>
                <DialogDescription className="text-lg font-light italic">{species.common_name}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                <div>
                  <h4 className="font-semibold">Kingdom</h4>
                  <p>{species.kingdom}</p>
                </div>
                <div>
                  <h4 className="font-semibold">Total population</h4>
                  <p>{species.total_population ? species.total_population.toLocaleString() : "Unknown"}</p>
                </div>
                <div>
                  <h4 className="font-semibold">Description</h4>
                  <p>{species.description ?? "No description provided."}</p>
                </div>
              </div>
              {isAuthor && (
                <Button className="mt-3 w-full" onClick={() => setIsEditing(true)}>
                  Edit
                </Button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}