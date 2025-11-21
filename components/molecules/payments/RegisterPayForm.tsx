"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useState } from "react";
import { Customer } from "@/types/customer";

const formSchema = z.object({
  bank: z.string({ required_error: "El apellido es obligatorio" }).min(2, {
    message: "Escriba su apellido correctamente",
  }),
  phoneNumber: z
    .string({ required_error: "El teléfono es obligatorio" })
    .trim()
    .regex(
      /[1-9]\d{7,14}$/,
      "Teléfono inválido. Usa formato internacional (+123456789)."
    ),
  amount: z.string({ required_error: "El monto es obligatorio" }).min(2, {
    message: "El formato de cedula es invalido",
  }),
  code: z
    .string({ required_error: "El codigo es obligatorio" })
    .min(4, {
      message: "El formato de cedula es invalido",
    })
    .max(4, { message: "coloque solo los primeros 4 numeros" }),
  comments: z.string(),
});

export function RegisterPayForm() {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer>();
  const [searchedCustomer, setSearchedCustomer] = useState<Customer>();
  const [sumbited, setSubmited] = useState(false);
  const [error, setError] = useState(false);

  const searchCustomer = async (dni: string) => {
    const res = await fetch(`http://localhost:3000/api/v1/customer/${dni}`);
    const customer = await res.json();
    if (customer) {
      setSearchedCustomer(customer[0]);
    }
  };

  const selectCustomer = () => {
    setSelectedCustomer(searchedCustomer);
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      phoneNumber: "",
      bank: "",
      amount: "",
      code: "",
      comments: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);
  }

  {
    sumbited && <></>;
  }
  {
    error && <></>;
  }
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {selectedCustomer ? (
          <div className="container mx-auto w-fit p-2 rounded-lg bg-accent cursor-pointer text-white flex gap-2">
            <p>{selectedCustomer.name}</p>
            <p>{selectedCustomer.national_identification_number}</p>
          </div>
        ) : (
          <div>
            <Input
              onChange={(e) => {
                if (e.target.value.length >= 7) {
                  searchCustomer(e.target.value);
                }
              }}
              placeholder="Cedula"
            />
            {searchedCustomer && (
              <motion.div
                className="absolute z-[1000]"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="mt-2">
                  <CardContent className="p-4 py-0 space-y-2">
                    <div
                      onClick={selectCustomer}
                      className="p-2 rounded-lg bg-muted hover:bg-accent cursor-pointer"
                    >
                      {searchedCustomer.name}{" "}
                      {searchedCustomer.national_identification_number}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        )}

        <FormField
          control={form.control}
          name="phoneNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Numero de Telefono</FormLabel>
              <FormControl>
                <Input
                  disabled={selectedCustomer ? false : true}
                  placeholder="Numero de telefono"
                  type="tel"
                  {...field}
                />
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
                <Input
                  disabled={selectedCustomer ? false : true}
                  placeholder="0.00$"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="bank"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Banco desde donde realizó el pago</FormLabel>
              <FormControl>
                <Select
                  disabled={selectedCustomer ? false : true}
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccione su banco" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Banca Amiga">Banca Amiga</SelectItem>
                    <SelectItem value="Banesco">Banesco</SelectItem>
                    <SelectItem value="Banco Venezuela">
                      Banco Venezuela
                    </SelectItem>
                  </SelectContent>
                </Select>
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
                <Input
                  disabled={selectedCustomer ? false : true}
                  placeholder="0000"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="comments"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{"Comenterios (Opcional)"}</FormLabel>
              <FormControl>
                <Textarea
                  disabled={selectedCustomer ? false : true}
                  placeholder="Comentario..."
                  {...field}
                />
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
}
