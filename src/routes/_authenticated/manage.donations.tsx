import { createFileRoute } from "@tanstack/react-router";
import { DonationsTable } from "@/components/donations/DonationsTable";

export const Route = createFileRoute("/_authenticated/manage/donations")({
  component: ManageDonations,
  head: () => ({ meta: [{ title: "Doações" }] }),
});

function ManageDonations() {
  return <DonationsTable />;
}
