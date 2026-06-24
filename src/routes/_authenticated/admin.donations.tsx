import { createFileRoute } from "@tanstack/react-router";
import { DonationsTable } from "@/components/donations/DonationsTable";

export const Route = createFileRoute("/_authenticated/admin/donations")({
  component: AdminDonations,
  head: () => ({ meta: [{ title: "Doações" }] }),
});

function AdminDonations() {
  return <DonationsTable />;
}
