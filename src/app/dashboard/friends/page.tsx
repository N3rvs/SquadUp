'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

export default function FriendsPage() {
    return (
        <div className="flex flex-col items-center justify-center text-center h-full p-4">
            <Card className="max-w-lg">
                <CardHeader>
                     <div className="mx-auto bg-secondary p-3 rounded-full w-fit mb-4">
                        <Users className="h-10 w-10 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-headline">Friends</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">This feature is temporarily unavailable.</p>
                </CardContent>
            </Card>
        </div>
    );
}
