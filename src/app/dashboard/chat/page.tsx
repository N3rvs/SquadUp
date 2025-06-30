
"use client";

import Link from "next/link";
import { MessageSquare, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function ChatPage() {
    return (
        <div className="flex flex-col items-center justify-center text-center h-full p-4">
            <Card className="max-w-lg">
                <CardHeader>
                    <div className="mx-auto bg-secondary p-3 rounded-full w-fit mb-4">
                        <MessageSquare className="h-10 w-10 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-headline">El Chat ha Cambiado de Lugar</CardTitle>
                    <CardDescription>
                        Para una experiencia más integrada, ahora puedes iniciar un chat directamente desde tu lista de amigos.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild>
                        <Link href="/dashboard/friends">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Ir a mis Amigos
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
