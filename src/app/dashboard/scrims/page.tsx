import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ScrimsPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-bold font-headline">Scrims</h1>
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            The scrims section is under construction. Check back later!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
