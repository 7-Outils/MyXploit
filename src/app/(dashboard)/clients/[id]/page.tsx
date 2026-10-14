import ClientsWorkspace from "@/components/clients/ClientsWorkspace";

// /clients/[id] = le même écran maître-détail, client présélectionné.
// Gardé pour les liens existants (fiche mission, rechargement après création de contrat).
export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClientsWorkspace initialClientId={id} />;
}
