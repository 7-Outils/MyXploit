"use client";

import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import type { AnalyticsData, Alert } from "@/components/energy/types";

interface SynthesisPdfData {
  organizationName: string;
  contractRef: string;
  year: number;
  yearLabel: string;
  analytics: AnalyticsData;
  activeAlerts: Alert[];
}

/* Palette alignée sur l'UI web (tailwind tokens utilisés dans SyntheseTab) */
const C = {
  pageBg: "#f8fafc",       // bg gris clair derrière les cards
  cardBg: "#ffffff",
  border: "#e5e7eb",       // border-gray-200
  ink: "#0f172a",          // primary-dark
  inkSoft: "#334155",
  muted: "#6b7280",
  mutedLight: "#9ca3af",
  rowAlt: "#f9fafb",
  // Accent
  accent: "#6366f1",
  // KPI icon hues (fond pastel + texte foncé)
  orangeBg: "#fff7ed", orange: "#ea580c",
  blueBg: "#eff6ff",   blue: "#2563eb",
  greenBg: "#dcfce7",  green: "#16a34a", greenInk: "#15803d",
  redBg: "#fee2e2",    red: "#dc2626",   redInk: "#b91c1c",
  amberBg: "#fef3c7",  amber: "#d97706", amberInk: "#92400e",
  indigoBg: "#eef2ff", indigo: "#4f46e5",
};

/* Format FR mais avec espace normal (la narrow no-break space n'est pas
   dans la police par défaut → rendu en "/") */
function nf(n: number, digits = 0): string {
  return n
    .toLocaleString("fr-FR", { maximumFractionDigits: digits, minimumFractionDigits: digits })
    .replace(/ /g, " ")
    .replace(/ /g, " ");
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingBottom: 40,
    paddingHorizontal: 24,
    fontSize: 9,
    color: C.ink,
    fontFamily: "Helvetica",
    backgroundColor: C.pageBg,
  },
  /* ─── Carte enveloppe ─── */
  card: {
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: "solid",
    borderRadius: 8,
  },
  /* ─── Header ─── */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 18,
    marginBottom: 12,
  },
  brand: {
    fontSize: 7.5,
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: C.ink,
  },
  subtitle: {
    fontSize: 10,
    color: C.inkSoft,
    marginTop: 4,
  },
  exploitant: {
    fontSize: 9,
    color: C.muted,
    marginTop: 2,
  },
  metaRight: {
    alignItems: "flex-end",
  },
  metaPill: {
    backgroundColor: C.indigoBg,
    color: C.indigo,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 6,
  },
  metaDate: {
    fontSize: 8,
    color: C.muted,
  },

  /* ─── KPI grid ─── */
  kpiRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: "solid",
    borderRadius: 8,
    padding: 12,
  },
  kpiTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  kpiLabel: {
    fontSize: 7,
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    flex: 1,
  },
  kpiIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiIconText: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
  },
  kpiValue: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: C.ink,
    letterSpacing: -0.3,
  },
  kpiUnit: {
    fontSize: 8,
    color: C.muted,
    marginTop: 3,
  },
  kpiChange: {
    fontSize: 7.5,
    marginTop: 4,
    fontFamily: "Helvetica-Bold",
  },

  /* ─── Section card ─── */
  sectionCard: {
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.border,
    borderStyle: "solid",
    borderRadius: 8,
    marginBottom: 12,
    overflow: "hidden",
  },
  sectionHeader: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: C.ink,
  },
  sectionSubtitle: {
    fontSize: 8,
    color: C.muted,
    marginTop: 2,
  },

  /* ─── Table ─── */
  trHead: {
    flexDirection: "row",
    backgroundColor: C.rowAlt,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderTopWidth: 0.5,
    borderTopColor: C.border,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  th: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  tr: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderBottomWidth: 0.3,
    borderBottomColor: C.border,
    alignItems: "center",
  },
  td: {
    fontSize: 8.5,
    color: C.ink,
  },
  tdMono: {
    fontSize: 8.5,
    color: C.inkSoft,
    fontFamily: "Courier",
  },
  tdMonoStrong: {
    fontSize: 8.5,
    color: C.ink,
    fontFamily: "Courier",
  },
  trTotal: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: C.rowAlt,
    borderTopWidth: 0.5,
    borderTopColor: C.border,
  },
  badge: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    textAlign: "center",
  },

  /* ─── Alertes ─── */
  alertItem: {
    marginHorizontal: 14,
    marginVertical: 4,
    paddingLeft: 10,
    paddingVertical: 8,
    paddingRight: 12,
    borderLeftWidth: 3,
    borderLeftStyle: "solid",
    borderRadius: 4,
  },
  alertHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  alertTitle: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: C.ink,
    flex: 1,
    paddingRight: 8,
  },
  alertMessage: {
    fontSize: 8,
    color: C.muted,
    marginTop: 2,
  },

  /* ─── Footnote ─── */
  footnote: {
    fontSize: 7,
    color: C.muted,
    paddingHorizontal: 18,
    paddingVertical: 10,
    fontStyle: "italic",
  },

  /* ─── Footer ─── */
  footer: {
    position: "absolute",
    bottom: 16,
    left: 24,
    right: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: C.muted,
  },
});

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  ECONOMIE: { bg: C.greenBg, color: C.greenInk, label: "Économie" },
  DEPASSEMENT: { bg: C.redBg, color: C.redInk, label: "Dépassement" },
  OBJECTIF: { bg: C.blueBg, color: C.blue, label: "Objectif" },
  INCOMPLET: { bg: C.amberBg, color: C.amberInk, label: "Incomplet" },
};

const PRIORITY_STYLE: Record<string, { bg: string; border: string; tagBg: string; tagColor: string }> = {
  CRITIQUE: { bg: "#fef2f2", border: C.red, tagBg: C.redBg, tagColor: C.redInk },
  HAUTE: { bg: "#fffbeb", border: C.amber, tagBg: C.amberBg, tagColor: C.amberInk },
  MOYENNE: { bg: "#eff6ff", border: C.blue, tagBg: C.blueBg, tagColor: C.blue },
  BASSE: { bg: "#f9fafb", border: C.muted, tagBg: "#f3f4f6", tagColor: C.muted },
};

/* Première lettre majuscule */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildExecLine(s: AnalyticsData["summary"], yearLabel: string): string {
  const ecartAbs = Math.abs(s.deltaPercent);
  const verb =
    s.status === "ECONOMIE"
      ? "présente une économie globale"
      : s.status === "DEPASSEMENT"
      ? "est en dépassement"
      : "est conforme à l'objectif";
  return `Sur ${yearLabel.toLowerCase()}, le portefeuille ${verb} de ${ecartAbs} % par rapport à la consommation théorique N'B. Sur ${s.totalSites} sites suivis, ${s.sitesEnEconomie} sont en économie et ${s.sitesEnDepassement} en dépassement.`;
}

/* ─────────────── Composant KPI ─────────────── */
function KpiCard({
  label,
  value,
  unit,
  iconLetter,
  iconBg,
  iconColor,
  changeText,
  changeColor,
}: {
  label: string;
  value: string;
  unit?: string;
  iconLetter: string;
  iconBg: string;
  iconColor: string;
  changeText?: string;
  changeColor?: string;
}) {
  return (
    <View style={styles.kpiCard}>
      <View style={styles.kpiTopRow}>
        <Text style={styles.kpiLabel}>{label}</Text>
        <View style={[styles.kpiIcon, { backgroundColor: iconBg }]}>
          <Text style={[styles.kpiIconText, { color: iconColor }]}>{iconLetter}</Text>
        </View>
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      {unit && <Text style={styles.kpiUnit}>{unit}</Text>}
      {changeText && (
        <Text style={[styles.kpiChange, { color: changeColor ?? C.muted }]}>{changeText}</Text>
      )}
    </View>
  );
}

/* ─────────────── Document ─────────────── */
export function SynthesisDocument({ data }: { data: SynthesisPdfData }) {
  const { organizationName, contractRef, yearLabel, analytics, activeAlerts } = data;
  const s = analytics.summary;
  const editedAt = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const sites = analytics.sites.filter((site) => site.nb != null);
  const exec = buildExecLine(s, yearLabel);
  const deltaPositive = s.deltaPercent <= 0;

  return (
    <Document
      title={`Bilan énergétique ${contractRef} ${yearLabel}`}
      author={organizationName}
    >
      <Page size="A4" style={styles.page}>
        {/* ─── Header card ─── */}
        <View style={[styles.card, styles.header]}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            <Text style={styles.brand}>
              {capitalize(organizationName)} · suivi énergétique via MyXploit
            </Text>
            <Text style={styles.title}>Bilan énergétique — {contractRef}</Text>
            <Text style={[styles.subtitle, { marginTop: 10, lineHeight: 1.5 }]}>{exec}</Text>
          </View>
          <View style={styles.metaRight}>
            <Text style={styles.metaPill}>{yearLabel}</Text>
            <Text style={styles.metaDate}>Édité le {editedAt}</Text>
          </View>
        </View>

        {/* ─── KPI grid ─── */}
        <View style={styles.kpiRow}>
          <KpiCard
            label="NC (Conso. réelle)"
            value={`${nf(s.totalNc / 1000, 0)}`}
            unit="MWh"
            iconLetter="N"
            iconBg={C.orangeBg}
            iconColor={C.orange}
          />
          <KpiCard
            label="N'B (Théorique)"
            value={`${nf(s.totalNbPrime / 1000, 0)}`}
            unit="MWh"
            iconLetter="T"
            iconBg={C.blueBg}
            iconColor={C.blue}
          />
          <KpiCard
            label="Écart NC / N'B"
            value={`${s.deltaPercent > 0 ? "+" : ""}${s.deltaPercent}%`}
            iconLetter={deltaPositive ? "↓" : "↑"}
            iconBg={deltaPositive ? C.greenBg : C.redBg}
            iconColor={deltaPositive ? C.greenInk : C.redInk}
            changeText={
              s.status === "ECONOMIE" ? "Économie" : s.status === "DEPASSEMENT" ? "Dépassement" : "Objectif atteint"
            }
            changeColor={deltaPositive ? C.greenInk : C.redInk}
          />
          <KpiCard
            label="Sites en économie"
            value={`${s.sitesEnEconomie}/${s.totalSites}`}
            iconLetter="●"
            iconBg={C.indigoBg}
            iconColor={C.indigo}
          />
          <KpiCard
            label="Sites en dépassement"
            value={`${s.sitesEnDepassement}/${s.totalSites}`}
            iconLetter="!"
            iconBg={s.sitesEnDepassement > 0 ? C.redBg : C.greenBg}
            iconColor={s.sitesEnDepassement > 0 ? C.redInk : C.greenInk}
            changeText={s.sitesEnDepassement > 0 ? "À surveiller" : "Aucune dérive"}
            changeColor={s.sitesEnDepassement > 0 ? C.redInk : C.greenInk}
          />
        </View>

        {/* ─── Performance par site ─── */}
        {sites.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Performance par site</Text>
              <Text style={styles.sectionSubtitle}>
                {sites.length} site{sites.length > 1 ? "s" : ""} avec NB renseigné
              </Text>
            </View>

            <View style={styles.trHead}>
              <Text style={[styles.th, { flex: 3 }]}>Site</Text>
              <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>NB</Text>
              <Text style={[styles.th, { flex: 0.9, textAlign: "right" }]}>DJC</Text>
              <Text style={[styles.th, { flex: 0.9, textAlign: "right" }]}>DJR</Text>
              <Text style={[styles.th, { flex: 1.1, textAlign: "right" }]}>NC (MWh)</Text>
              <Text style={[styles.th, { flex: 1.1, textAlign: "right" }]}>N&apos;B (MWh)</Text>
              <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Écart</Text>
              <Text style={[styles.th, { flex: 1.4, textAlign: "center" }]}>Statut</Text>
            </View>

            {sites.map((site) => {
              const sb = STATUS_BADGE[site.status] ?? STATUS_BADGE.OBJECTIF;
              const deltaColor =
                site.status === "INCOMPLET" ? C.muted : site.deltaPercent <= 0 ? C.greenInk : C.redInk;
              return (
                <View key={site.siteId} style={styles.tr} wrap={false}>
                  <Text style={[styles.td, { flex: 3 }]}>{site.siteName}</Text>
                  <Text style={[styles.tdMono, { flex: 1, textAlign: "right" }]}>
                    {site.nb != null ? nf(site.nb) : "—"}
                  </Text>
                  <Text style={[styles.tdMono, { flex: 0.9, textAlign: "right", color: C.mutedLight }]}>
                    {site._debug?.usedDjuc ?? "—"}
                  </Text>
                  <Text style={[styles.tdMono, { flex: 0.9, textAlign: "right", color: C.mutedLight }]}>
                    {site._debug?.djrTotal ?? "—"}
                  </Text>
                  <Text style={[styles.tdMonoStrong, { flex: 1.1, textAlign: "right" }]}>
                    {nf(site.nc / 1000, 1)}
                  </Text>
                  <Text style={[styles.tdMono, { flex: 1.1, textAlign: "right" }]}>
                    {nf(site.nbPrime / 1000, 1)}
                  </Text>
                  <Text
                    style={[
                      styles.tdMono,
                      {
                        flex: 1,
                        textAlign: "right",
                        color: deltaColor,
                        fontFamily: "Helvetica-Bold",
                      },
                    ]}
                  >
                    {site.status === "INCOMPLET"
                      ? "—"
                      : `${site.deltaPercent > 0 ? "+" : ""}${site.deltaPercent}%`}
                  </Text>
                  <View style={{ flex: 1.4, alignItems: "center" }}>
                    <Text
                      style={[
                        styles.badge,
                        { backgroundColor: sb.bg, color: sb.color },
                      ]}
                    >
                      {sb.label}
                    </Text>
                  </View>
                </View>
              );
            })}

            {/* Total row */}
            <View style={styles.trTotal}>
              <Text style={[styles.td, { flex: 3, fontFamily: "Helvetica-Bold" }]}>Total portefeuille</Text>
              <Text style={[styles.tdMono, { flex: 1, textAlign: "right" }]}>—</Text>
              <Text style={[styles.tdMono, { flex: 0.9, textAlign: "right" }]}>—</Text>
              <Text style={[styles.tdMono, { flex: 0.9, textAlign: "right" }]}>—</Text>
              <Text style={[styles.tdMonoStrong, { flex: 1.1, textAlign: "right", fontFamily: "Helvetica-Bold" }]}>
                {nf(s.totalNc / 1000, 1)}
              </Text>
              <Text style={[styles.tdMono, { flex: 1.1, textAlign: "right" }]}>
                {nf(s.totalNbPrime / 1000, 1)}
              </Text>
              <Text
                style={[
                  styles.tdMono,
                  {
                    flex: 1,
                    textAlign: "right",
                    color: deltaPositive ? C.greenInk : C.redInk,
                    fontFamily: "Helvetica-Bold",
                  },
                ]}
              >
                {s.deltaPercent > 0 ? "+" : ""}
                {s.deltaPercent}%
              </Text>
              <View style={{ flex: 1.4 }} />
            </View>

            <Text style={styles.footnote}>
              Unités en MWh sauf NB (kWh). NB : objectif contractuel · N&apos;B : objectif corrigé du climat (DJR/DJC) ·
              NC : consommation réelle constatée. Écart négatif = économie.
            </Text>
          </View>
        )}

        {/* ─── Alertes ─── */}
        {activeAlerts.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Alertes dérives actives</Text>
              <Text style={styles.sectionSubtitle}>
                {activeAlerts.length} alerte{activeAlerts.length > 1 ? "s" : ""} en cours
              </Text>
            </View>

            <View style={{ paddingBottom: 8 }}>
              {activeAlerts.slice(0, 8).map((alert) => {
                const ps = PRIORITY_STYLE[alert.priority] ?? PRIORITY_STYLE.MOYENNE;
                return (
                  <View
                    key={alert.id}
                    style={[
                      styles.alertItem,
                      { backgroundColor: ps.bg, borderLeftColor: ps.border },
                    ]}
                    wrap={false}
                  >
                    <View style={styles.alertHead}>
                      <Text style={styles.alertTitle}>{alert.title}</Text>
                      <Text
                        style={[
                          styles.badge,
                          { backgroundColor: ps.tagBg, color: ps.tagColor },
                        ]}
                      >
                        {alert.priority}
                      </Text>
                    </View>
                    <Text style={styles.alertMessage}>{alert.message}</Text>
                  </View>
                );
              })}
              {activeAlerts.length > 8 && (
                <Text style={[styles.footnote, { paddingVertical: 6 }]}>
                  + {activeAlerts.length - 8} autres alertes non listées dans ce rapport.
                </Text>
              )}
            </View>
          </View>
        )}

        {/* ─── Footer ─── */}
        <View style={styles.footer} fixed>
          <Text>
            {contractRef} · {yearLabel} · Édité le {editedAt}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
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
