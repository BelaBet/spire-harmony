import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/manage/settings")({
  component: () => (
    <Card className="p-8 text-center text-muted-foreground">
      Configurações de tenant, branding e API keys virão na fase 4.
    </Card>
  ),
});
