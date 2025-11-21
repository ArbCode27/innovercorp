"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
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

const formSchema = z.object({
  dni: z.string().min(7, {
    message: "El formato de cedula es invalido",
  }),
  contract: z.string().min(2, {
    message: "Seleccione un plan",
  }),
  days: z.string().min(2, {
    message: "El formato de cedula es invalido",
  }),
  amount: z.string().min(2, {
    message: "El formato de cedula es invalido",
  }),
  code: z.string().min(7, {
    message: "El formato de cedula es invalido",
  }),
  comment: z.string(),
});

export const RegisterPrePayForm = () => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      dni: "",
      days: "",
      amount: "",
      code: "",
      comment: "",
    },
  });

  // 2. Define a submit handler.
  function onSubmit(values: z.infer<typeof formSchema>) {
    // Do something with the form values.
    // ✅ This will be type-safe and validated.
    console.log(values);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="dni"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cedula de identidad</FormLabel>
              <FormControl>
                <Input placeholder="Cedula" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="dni"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Seleccione su contrato</FormLabel>
              <FormControl>
                <Select>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Seleccione su plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">200mb</SelectItem>
                    <SelectItem value="15">300mb</SelectItem>
                    <SelectItem value="20">500mb</SelectItem>
                    <SelectItem value="25">800mb</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="dni"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Seleccione la catidad de dias</FormLabel>
              <FormControl>
                <Select>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Dias a pagar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 Dias</SelectItem>
                    <SelectItem value="15">15 Dias</SelectItem>
                    <SelectItem value="20">20 Dias</SelectItem>
                    <SelectItem value="25">25 Dias</SelectItem>
                    <SelectItem value="30">30 Dias</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Monto Pagado</FormLabel>
              <FormControl>
                <Input placeholder="0.00$" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Codigo de referencia</FormLabel>
              <FormControl>
                <Input placeholder="0000" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="comment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{"Comenterios (Opcional)"}</FormLabel>
              <FormControl>
                <Input placeholder="Cedula" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className="w-full" type="submit">
          Registrar pago
        </Button>
      </form>
    </Form>
  );
};
