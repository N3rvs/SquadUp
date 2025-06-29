"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, CheckCircle, BrainCircuit } from "lucide-react";
import { categorizeProblem, sendSupportEmail } from "@/app/dashboard/support/actions";

type Stage = "initial" | "analyzing" | "confirming" | "sent";

const initialFormSchema = z.object({
  problemDescription: z.string().min(20, "Por favor, describe tu problema con al menos 20 caracteres."),
});

const confirmationFormSchema = z.object({
    subject: z.string().min(5, "El asunto es requerido."),
    body: z.string().min(20, "El cuerpo del mensaje es requerido."),
});

export function SupportForm() {
    const [stage, setStage] = useState<Stage>("initial");
    const [category, setCategory] = useState("");
    const { toast } = useToast();

    const initialForm = useForm<z.infer<typeof initialFormSchema>>({
        resolver: zodResolver(initialFormSchema),
        defaultValues: { problemDescription: "" },
    });

    const confirmationForm = useForm<z.infer<typeof confirmationFormSchema>>({
        resolver: zodResolver(confirmationFormSchema),
        defaultValues: { subject: "", body: "" },
    });

    const handleInitialSubmit = async (values: z.infer<typeof initialFormSchema>) => {
        setStage("analyzing");
        const result = await categorizeProblem(values.problemDescription);
        if (result.success) {
            confirmationForm.reset({
                subject: result.data.subject,
                body: result.data.summary,
            });
            setCategory(result.data.category);
            setStage("confirming");
        } else {
            toast({
                variant: "destructive",
                title: "Error de Análisis",
                description: result.error,
            });
            setStage("initial");
        }
    };
    
    const handleConfirmationSubmit = async (values: z.infer<typeof confirmationFormSchema>) => {
        setStage("analyzing"); // Reuse analyzing state for sending
        const result = await sendSupportEmail({ ...values, category });
        if (result.success) {
            setStage("sent");
        } else {
            toast({
                variant: "destructive",
                title: "Error al Enviar",
                description: result.error,
            });
            setStage("confirming");
        }
    };

    if (stage === "sent") {
        return (
            <div className="text-center py-10">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold">¡Mensaje Enviado!</h3>
                <p className="text-muted-foreground mt-2">
                    Gracias por contactarnos. El equipo de soporte revisará tu solicitud pronto.
                </p>
            </div>
        );
    }
    
    if (stage === "analyzing") {
        return (
            <div className="text-center py-10">
                <Loader2 className="h-16 w-16 text-primary animate-spin mx-auto mb-4" />
                <h3 className="text-xl font-semibold">Analizando tu solicitud...</h3>
                <p className="text-muted-foreground mt-2">
                    Nuestra IA está trabajando para entender y categorizar tu problema.
                </p>
            </div>
        )
    }

    if (stage === "confirming") {
        return (
            <Form {...confirmationForm}>
                <form onSubmit={confirmationForm.handleSubmit(handleConfirmationSubmit)} className="space-y-4">
                    <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground">Categoría Detectada:</p>
                        <Badge variant="secondary">{category}</Badge>
                    </div>
                     <FormField
                        control={confirmationForm.control}
                        name="subject"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Asunto</FormLabel>
                                <FormControl><Input {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={confirmationForm.control}
                        name="body"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Detalles del Problema</FormLabel>
                                <FormControl><Textarea {...field} rows={6} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                     <Button type="submit" className="w-full">
                        <Send className="mr-2 h-4 w-4" /> Enviar a Soporte
                    </Button>
                </form>
            </Form>
        );
    }

    return (
        <Form {...initialForm}>
            <form onSubmit={initialForm.handleSubmit(handleInitialSubmit)} className="space-y-4">
                <FormField
                    control={initialForm.control}
                    name="problemDescription"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>¿En qué podemos ayudarte?</FormLabel>
                            <FormControl>
                                <Textarea
                                    placeholder="Ej: No puedo unirme a un torneo, me da un error al hacer clic en 'inscribirse'."
                                    rows={5}
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit" className="w-full">
                    <BrainCircuit className="mr-2 h-4 w-4" /> Analizar Problema
                </Button>
            </form>
        </Form>
    );
}
