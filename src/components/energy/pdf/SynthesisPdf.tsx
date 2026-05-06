"use client";

import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import type { AnalyticsData, Alert } from "@/components/energy/types";

interface SynthesisPdfData {
  organizationName: string;
  contractRef: string;
  year: number;
  yearLabel: string; // ex "Saison 2025/2026"
  analytics: AnalyticsData;
  activeAlerts: Alert[];
}

const colors = {
  primary: "#0f172a",
  secondary: "#64748b",
  border: "#e2e8f0",
  bg: "#f8fafc",
  accent: "#6366f1",
  green: "#16a34a",
  red: "#dc2626",
  amber: "#d97706",
  blue: "#2563eb",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 48,
    paddingHorizontal: 32,
    fontSize: 9,
    color: colors.primary,
    fontFamily: "Helvetica",
  },
  /* Header */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
  },
  headerSubtitle: {
    fontSize: 9,
    color: colors.secondary,
    marginTop: 4,
  },
  headerMeta: {
    fontSize: 8,
    color: colors.secondary,
    textAlign: "right",
  },
  /* Section title */
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    marginBottom: 8,
    marginTop: 12,
  },
  /* KPI grid */
  kpiRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 4,
  },
  kpiBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: 8,
  },
  kpiLabel: {
    fontSize: 7,
    color: colors.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
  },
  kpiHint: {
    fontSize: 7,
    color: colors.secondary,
    marginTop: 2,
  },
  /* Table */
  table: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  trHead: {
    flexDirection: "row",
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  th: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: colors.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tr: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  td: {
    fontSize: 8,
    color: colors.primary,
  },
  badge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  /* Alerts */
  alertItem: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    paddingVertical: 4,
    marginBottom: 4,
    backgroundColor: colors.bg,
    borderRadius: 2,
  },
  alertTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
  },
  alertMessage: {
    fontSize: 8,
    color: colors.secondary,
    marginTop: 2,
  },
  /* Footer */
  footer: {
    position: "absolute",
    bottom: 20,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: colors.secondary,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
  },
});

const statusLabel: Record<string, { text: string; color: string; bg: string }> = {
  ECONOMIE: { text: "Économie", color: colors.green, bg: "#dcfce7" },
  DEPASSEMENT: { text: "Dépassement", color: colors.red, bg: "#fee2e2" },
  OBJECTIF: { text: "Objectif", color: colors.blue, bg: "#dbeafe" },
  INCOMPLET: { text: "Incomplet", color: colors.amber, bg: "#fef3c7" },
};

const priorityColor: Record<string, string> = {
  CRITIQUE: colors.red,
  HAUTE: colors.amber,
  MOYENNE: colors.blue,
  BASSE: colors.secondary,
};

function formatNumber(n: number, digits = 0): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function SynthesisDocument({ data }: { data: SynthesisPdfData }) {
  const { organizationName, contractRef, yearLabel, analytics, activeAlerts } = data;
  const s = analytics.summary;
  const editedAt = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const sites = analytics.sites.filter((site) => site.nb != null);
  const deltaSign = s.deltaPercent > 0 ? "+" : "";
  const ecartLabel =
    s.status === "ECONOMIE"
      ? "Économie globale"
      : s.status === "DEPASSEMENT"
      ? "Dépassement"
      : "Objectif atteint";

  return (
    <Document
      title={`Synthèse énergétique ${contractRef} ${yearLabel}`}
      author="MyXploit"
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Synthèse énergétique</Text>
            <Text style={styles.headerSubtitle}>{contractRef}</Text>
          </View>
          <View>
            <Text style={styles.headerMeta}>{yearLabel}</Text>
            <Text style={styles.headerMeta}>Édité le {editedAt}</Text>
          </View>
        </View>

        {/* KPIs */}
        <Text style={styles.sectionTitle}>Indicateurs globaux</Text>
        <View style={styles.kpiRow}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>NC réelle</Text>
            <Text style={styles.kpiValue}>{(s.totalNc / 1000).toFixed(0)}</Text>
            <Text style={styles.kpiHint}>MWh</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>N&apos;B théorique</Text>
            <Text style={styles.kpiValue}>{(s.totalNbPrime / 1000).toFixed(0)}</Text>
            <Text style={styles.kpiHint}>MWh</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Écart NC/N&apos;B</Text>
            <Text
              style={{
                ...styles.kpiValue,
                color: s.deltaPercent <= 0 ? colors.green : colors.red,
              }}
            >
              {deltaSign}
              {s.deltaPercent}%
            </Text>
            <Text style={styles.kpiHint}>{ecartLabel}</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Sites en économie</Text>
            <Text style={styles.kpiValue}>
              {s.sitesEnEconomie}/{s.totalSites}
            </Text>
            <Text style={styles.kpiHint}>sur le portefeuille</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Sites en dépassement</Text>
            <Text
              style={{
                ...styles.kpiValue,
                color: s.sitesEnDepassement > 0 ? colors.red : colors.primary,
              }}
            >
              {s.sitesEnDepassement}/{s.totalSites}
            </Text>
            <Text style={styles.kpiHint}>
              {s.sitesEnDepassement > 0 ? "à surveiller" : "aucune dérive"}
            </Text>
          </View>
        </View>

        {/* Table sites */}
        {sites.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Performance par site</Text>
            <View style={styles.table}>
              <View style={styles.trHead}>
                <Text style={[styles.th, { flex: 3 }]}>Site</Text>
                <Text style={[styles.th, { flex: 1.2, textAlign: "right" }]}>NB (MWh)</Text>
                <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>DJC</Text>
                <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>DJR</Text>
                <Text style={[styles.th, { flex: 1.2, textAlign: "right" }]}>NC (MWh)</Text>
                <Text style={[styles.th, { flex: 1.2, textAlign: "right" }]}>N&apos;B (MWh)</Text>
                <Text style={[styles.th, { flex: 1.2, textAlign: "right" }]}>Écart</Text>
                <Text style={[styles.th, { flex: 1.6, textAlign: "center" }]}>Statut</Text>
              </View>
              {sites.map((site, idx) => {
                const sl = statusLabel[site.status] ?? statusLabel.OBJECTIF;
                const deltaColor =
                  site.status === "INCOMPLET"
                    ? colors.secondary
                    : site.deltaPercent <= 0
                    ? colors.green
                    : colors.red;
                return (
                  <View
                    key={site.siteId}
                    style={{
                      ...styles.tr,
                      backgroundColor: idx % 2 === 1 ? colors.bg : "white",
                      borderBottomWidth: idx === sites.length - 1 ? 0 : 0.5,
                    }}
                  >
                    <Text style={[styles.td, { flex: 3 }]} wrap={false}>
                      {site.siteName}
                    </Text>
                    <Text style={[styles.td, { flex: 1.2, textAlign: "right" }]}>
                      {site.nb != null ? formatNumber(site.nb) : "—"}
                    </Text>
                    <Text style={[styles.td, { flex: 1, textAlign: "right", color: colors.secondary }]}>
                      {site._debug?.usedDjuc ?? "—"}
                    </Text>
                    <Text style={[styles.td, { flex: 1, textAlign: "right", color: colors.secondary }]}>
                      {site._debug?.djrTotal ?? "—"}
                    </Text>
                    <Text style={[styles.td, { flex: 1.2, textAlign: "right" }]}>
                      {(site.nc / 1000).toFixed(1)}
                    </Text>
                    <Text style={[styles.td, { flex: 1.2, textAlign: "right", color: colors.secondary }]}>
                      {(site.nbPrime / 1000).toFixed(1)}
                    </Text>
                    <Text
                      style={[
                        styles.td,
                        { flex: 1.2, textAlign: "right", color: deltaColor, fontFamily: "Helvetica-Bold" },
                      ]}
                    >
                      {site.status === "INCOMPLET"
                        ? "—"
                        : `${site.deltaPercent > 0 ? "+" : ""}${site.deltaPercent}%`}
                    </Text>
                    <View style={{ flex: 1.6, alignItems: "center", justifyContent: "center" }}>
                      <Text
                        style={{
                          ...styles.badge,
                          color: sl.color,
                          backgroundColor: sl.bg,
                        }}
                      >
                        {sl.text}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Alertes */}
        {activeAlerts.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              Alertes actives ({activeAlerts.length})
            </Text>
            <View>
              {activeAlerts.slice(0, 8).map((alert) => (
                <View
                  key={alert.id}
                  style={{
                    ...styles.alertItem,
                    borderLeftColor: priorityColor[alert.priority] ?? colors.secondary,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <Text style={styles.alertTitle}>{alert.title}</Text>
                    <Text
                      style={{
                        ...styles.badge,
                        color: priorityColor[alert.priority] ?? colors.secondary,
                        backgroundColor: "white",
                        borderWidth: 0.5,
                        borderColor: priorityColor[alert.priority] ?? colors.secondary,
                      }}
                    >
                      {alert.priority}
                    </Text>
                  </View>
                  <Text style={styles.alertMessage}>{alert.message}</Text>
                </View>
              ))}
              {activeAlerts.length > 8 && (
                <Text style={{ fontSize: 7, color: colors.secondary, marginTop: 4 }}>
                  + {activeAlerts.length - 8} autres alertes non affichées
                </Text>
              )}
            </View>
          </>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>
            {organizationName} · Synthèse {contractRef} · {yearLabel}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

export async function exportSynthesisPdf(data: SynthesisPdfData): Promise<void> {
  const blob = await pdf(<SynthesisDocument data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `synthese-${data.contractRef}-${data.year}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
