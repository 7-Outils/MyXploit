"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  FileText,
  ArrowLeftRight,
  Loader2,
  Plus,
  X,
  Check,
  Building2,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

interface UserSummary {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
}

interface ContractSummary {
  id: string;
  reference: string;
  title: string;
  provider: string;
  status: string;
  _count: { contractSites: number };
}

interface Assignment {
  id: string;
  userId: string;
  contractId: string;
  assignedAt: string;
  contract: ContractSummary;
}

import { ROLE_LABELS, ROLE_COLORS } from "@/lib/permissions";

export default function PortfolioAdminPage() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [allContracts, setAllContracts] = useState<ContractSummary[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [userAssignmentCounts, setUserAssignmentCounts] = useState<Record<string, number>>({});
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferToUserId, setTransferToUserId] = useState("");
  const [transferring, setTransferring] = useState(false);

  // Fetch users (EDITOR, READER, MANAGER - not ADMIN/SUPER_ADMIN)
  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        // Filtrer : on ne montre que les EDITOR/READER/MANAGER (pas les ADMIN et SUPER_ADMIN)
        const filteredUsers = data.filter(
          (u: UserSummary) => u.role !== "SUPER_ADMIN" && u.role !== "ADMIN"
        );
        setUsers(filteredUsers);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  }, []);

  // Fetch all contracts
  const fetchContracts = useCallback(async () => {
    try {
      const res = await fetch("/api/contracts");
      if (res.ok) {
        const data = await res.json();
        setAllContracts(data);
      }
    } catch (error) {
      console.error("Error fetching contracts:", error);
    }
  }, []);

  // Fetch all assignments (to get counts per user)
  const fetchAllAssignments = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/contract-assignments");
      if (res.ok) {
        const data: Assignment[] = await res.json();
        // Compteur par utilisateur
        const counts: Record<string, number> = {};
        data.forEach((a) => {
          counts[a.userId] = (counts[a.userId] || 0) + 1;
        });
        setUserAssignmentCounts(counts);
      }
    } catch (error) {
      console.error("Error fetching assignments:", error);
    }
  }, []);

  // Fetch assignments for selected user
  const fetchUserAssignments = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/contract-assignments?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setAssignments(data);
      }
    } catch (error) {
      console.error("Error fetching user assignments:", error);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchUsers(), fetchContracts(), fetchAllAssignments()]);
      setLoading(false);
    };
    init();
  }, [fetchUsers, fetchContracts, fetchAllAssignments]);

  useEffect(() => {
    if (selectedUserId) {
      fetchUserAssignments(selectedUserId);
    }
  }, [selectedUserId, fetchUserAssignments]);

  const selectedUser = users.find((u) => u.id === selectedUserId);
  const assignedContractIds = new Set(assignments.map((a) => a.contractId));
  const unassignedContracts = allContracts.filter((c) => !assignedContractIds.has(c.id));

  const handleAssignContract = async (contractId: string) => {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/contract-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, contractIds: [contractId] }),
      });
      if (res.ok) {
        await fetchUserAssignments(selectedUserId);
        await fetchAllAssignments();
      }
    } catch (error) {
      console.error("Error assigning contract:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAssignment = async (contractId: string) => {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/contract-assignments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, contractId }),
      });
      if (res.ok) {
        await fetchUserAssignments(selectedUserId);
        await fetchAllAssignments();
      }
    } catch (error) {
      console.error("Error removing assignment:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedUserId || !transferToUserId) return;
    setTransferring(true);
    try {
      const res = await fetch("/api/admin/contract-assignments/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromUserId: selectedUserId, toUserId: transferToUserId }),
      });
      if (res.ok) {
        const data = await res.json();
        alert(`${data.transferred} contrat(s) transféré(s) de ${data.fromUser} vers ${data.toUser}`);
        setShowTransferModal(false);
        setTransferToUserId("");
        await fetchUserAssignments(selectedUserId);
        await fetchAllAssignments();
      } else {
        const err = await res.json();
        alert(err.error || "Erreur lors de la passation");
      }
    } catch (error) {
      console.error("Error transferring:", error);
    } finally {
      setTransferring(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Portefeuilles ingénieurs</h1>
            <p className="text-gray-600 mt-1">
              Assigner des contrats aux membres de votre équipe
            </p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Panel: User List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Users size={18} className="text-accent" />
                Équipe ({users.length})
              </h2>
            </div>
            <div className="divide-y divide-gray-50">
              {users.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">Aucun membre trouvé</p>
              ) : (
                users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                      selectedUserId === u.id ? "bg-accent/5 border-l-2 border-accent" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          {u.firstName || ""} {u.lastName || ""}
                        </p>
                        <p className="text-xs text-gray-500">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {(userAssignmentCounts[u.id] || 0) > 0 && (
                          <span className="px-2 py-0.5 bg-accent/10 text-accent rounded-full text-xs font-medium">
                            {userAssignmentCounts[u.id]} contrat{(userAssignmentCounts[u.id] || 0) > 1 ? "s" : ""}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[u.role as keyof typeof ROLE_COLORS] || "bg-gray-100 text-gray-700"}`}>
                          {ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] || u.role}
                        </span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Contract Assignments */}
        <div className="lg:col-span-2">
          {!selectedUserId ? (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
              <Users size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">Sélectionnez un membre pour gérer ses contrats</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selected User Header */}
              <div className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-gray-900">
                      {selectedUser?.firstName || ""} {selectedUser?.lastName || ""}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {assignments.length} contrat{assignments.length > 1 ? "s" : ""} assigné{assignments.length > 1 ? "s" : ""}
                    </p>
                  </div>
                  {assignments.length > 0 && (
                    <button
                      onClick={() => setShowTransferModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors text-sm font-medium"
                    >
                      <ArrowLeftRight size={16} />
                      Passation
                    </button>
                  )}
                </div>
              </div>

              {/* Assigned Contracts */}
              {assignments.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100">
                  <div className="p-4 border-b border-gray-100">
                    <h3 className="font-medium text-gray-900 flex items-center gap-2">
                      <Check size={16} className="text-green-600" />
                      Contrats assignés
                    </h3>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {assignments.map((a) => (
                      <div key={a.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                            <FileText size={18} className="text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{a.contract.title}</p>
                            <p className="text-xs text-gray-500">
                              {a.contract.reference} - {a.contract.provider} - {a.contract._count.contractSites} site{a.contract._count.contractSites > 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveAssignment(a.contractId)}
                          disabled={saving}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Retirer"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Available Contracts */}
              {unassignedContracts.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100">
                  <div className="p-4 border-b border-gray-100">
                    <h3 className="font-medium text-gray-900 flex items-center gap-2">
                      <Building2 size={16} className="text-gray-400" />
                      Contrats disponibles ({unassignedContracts.length})
                    </h3>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {unassignedContracts.map((c) => (
                      <div key={c.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
                            <FileText size={18} className="text-gray-400" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{c.title}</p>
                            <p className="text-xs text-gray-500">
                              {c.reference} - {c.provider} - {c._count.contractSites} site{c._count.contractSites > 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAssignContract(c.id)}
                          disabled={saving}
                          className="flex items-center gap-1 px-3 py-1.5 text-accent bg-accent/5 hover:bg-accent/10 rounded-lg transition-colors text-sm font-medium"
                        >
                          <Plus size={14} />
                          Assigner
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {assignments.length === 0 && unassignedContracts.length === 0 && (
                <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
                  <p className="text-gray-500">Aucun contrat disponible</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Transfer Modal */}
      {showTransferModal && selectedUserId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Passation de portefeuille</h3>
            <p className="text-sm text-gray-600 mb-4">
              Transférer les {assignments.length} contrat{assignments.length > 1 ? "s" : ""} de{" "}
              <strong>{selectedUser?.firstName} {selectedUser?.lastName}</strong> vers :
            </p>

            <select
              value={transferToUserId}
              onChange={(e) => setTransferToUserId(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg mb-4"
            >
              <option value="">Sélectionner un destinataire</option>
              {users
                .filter((u) => u.id !== selectedUserId)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName || ""} {u.lastName || ""} ({u.email})
                  </option>
                ))}
            </select>

            {/* Liste des contrats qui seront transférés */}
            <div className="max-h-40 overflow-y-auto mb-4 bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-500 mb-2">Contrats concernés :</p>
              {assignments.map((a) => (
                <p key={a.id} className="text-sm text-gray-700">
                  {a.contract.reference} - {a.contract.title}
                </p>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowTransferModal(false);
                  setTransferToUserId("");
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleTransfer}
                disabled={!transferToUserId || transferring}
                className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {transferring ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ArrowLeftRight size={16} />
                )}
                Transférer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
