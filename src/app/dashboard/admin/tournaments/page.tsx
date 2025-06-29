import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";

export default function TournamentsAdminPage() {
    return (
        <div className="grid gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline">Gestión de Torneos</h1>
                <p className="text-muted-foreground">Administra y modera todos los torneos de la comunidad.</p>
            </div>
             <Card>
                <CardHeader>
                    <CardTitle>Próximamente</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center text-center p-10 gap-4">
                    <Trophy className="h-12 w-12 text-muted-foreground" />
                    <h3 className="text-xl font-semibold">Panel de Torneos en Construcción</h3>
                    <p className="text-muted-foreground">
                        Esta sección te permitirá ver, aprobar, rechazar y gestionar todos los torneos.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
