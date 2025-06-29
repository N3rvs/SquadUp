
'use client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, LogOut } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export function BannedScreen({ banExpiresAt }: { banExpiresAt: string }) {
    const { toast } = useToast();
    const router = useRouter();

    const handleLogout = async () => {
        try {
            await signOut(auth);
            toast({ title: "Sesión cerrada" });
            router.push("/login");
        } catch (error) {
            toast({ variant: "destructive", title: "Error al cerrar sesión" });
        }
    };

    const formattedDate = format(new Date(banExpiresAt), "PPP 'a las' p", { locale: es });
    const isPermanent = new Date(banExpiresAt).getFullYear() >= 3000;


    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <div className="mx-auto bg-destructive/10 p-3 rounded-full w-fit">
                        <ShieldAlert className="h-10 w-10 text-destructive" />
                    </div>
                    <CardTitle className="text-2xl font-headline mt-4">Cuenta Suspendida</CardTitle>
                    <CardDescription>
                        {isPermanent 
                            ? "Tu acceso a la plataforma ha sido suspendido permanentemente."
                            : `Tu acceso a la plataforma ha sido suspendido temporalmente. Podrás volver a ingresar después del ${formattedDate}.`
                        }
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Si crees que esto es un error, por favor, contacta a soporte.
                    </p>
                    <Button onClick={handleLogout} className="mt-6 w-full">
                        <LogOut className="mr-2 h-4 w-4" />
                        Cerrar Sesión
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
