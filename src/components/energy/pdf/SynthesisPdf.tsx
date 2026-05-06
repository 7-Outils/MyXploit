"use client";

import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import type { AnalyticsData, Alert } from "@/components/energy/types";

interface SynthesisPdfData {
  contractRef: string;
  contractTitle: string;
  contractProvider: string;
  year: number;
  yearLabel: string;
  analytics: AnalyticsData;
  activeAlerts: Alert[];
}

const ink = "#0b0b0b";
const muted = "#6b6b6b";
const rule = "#cfcfcf";
const ruleSoft = "#e8e8e8";
const green = "#157a3c";
const red = "#a31818";

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 48,
    fontSize: 9,
    color: ink,
    fontFamily: "Helvetica",
    lineHeight: 1.4,
  },
  /* ─────── Cover header ─────── */
  topMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: muted,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: ink,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 10,
    color: ink,
    marginTop: 6,
  },
  exploitant: {
    fontSize: 9,
    color: muted,
    marginTop: 2,
  },
  ruleStrong: {
    height: 1.5,
    backgroundColor: ink,
    marginTop: 18,
    marginBottom: 4,
  },
  ruleThin: {
    height: 0.5,
    backgroundColor: rule,
    marginBottom: 24,
  },
  /* ─────── Executive summary ─────── */
  execText: {
    fontSize: 10,
    color: ink,
    lineHeight: 1.55,
    marginBottom: 24,
  },
  /* ─────── Section heading ─────── */
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginTop: 6,
    marginBottom: 12,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: rule,
  },
  sectionNum: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: muted,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: ink,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  /* ─────── KPI strip — pas de boîtes ─────── */
  kpiStrip: {
    flexDirection: "row",
    marginBottom: 24,
  },
  kpiCol: {
    flex: 1,
    paddingRight: 8,
  },
  kpiColBordered: {
    flex: 1,
    paddingLeft: 12,
    paddingRight: 8,
    borderLeftWidth: 0.5,
    borderLeftColor: ruleSoft,
  },
  kpiLabel: {
    fontSize: 6.5,
    color: muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: ink,
    letterSpacing: -0.5,
  },
  kpiUnit: {
    fontSize: 8,
    color: muted,
    marginTop: 2,
  },
  /* ─────── Table ─────── */
  trHead: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: ink,
  },
  th: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: ink,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  tr: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: ruleSoft,
  },
  td: {
    fontSize: 8.5,
    color: ink,
  },
  tdMono: {
    fontSize: 8.5,
    color: ink,
    fontFamily: "Courier",
  },
  trTotal: {
    flexDirection: "row",
    paddingVertical: 6,
    borderTopWidth: 0.5,
    borderTopColor: ink,
  },
  /* ─────── Alerts ─────── */
  alertRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: ruleSoft,
  },
  alertNum: {
    width: 20,
    fontSize: 8.5,
    color: muted,
    fontFamily: "Helvetica-Bold",
  },
  alertBody: {
    flex: 1,
  },
  alertHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  alertTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: ink,
  },
  alertPriority: {
    fontSize: 6.5,
    color: muted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  alertMessage: {
    fontSize: 8,
    color: muted,
    marginTop: 2,
  },
  /* ─────── Footnote ─────── */
  footnote: {
    fontSize: 7,
    color: muted,
    marginTop: 16,
    fontStyle: "italic",
  },
  /* ─────── Footer ─────── */
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: muted,
    paddingTop: 6,
    borderTopWidth: 0.3,
    borderTopColor: rule,
  },
});

const STATUS_TEXT: Record<string, { label: string; color: string }> = {
  ECONOMIE: { label: "Économie", color: green },
  DEPASSEMENT: { label: "Dépassement", color: red },
  OBJECTIF: { label: "Objectif", color: ink },
  INCOMPLET: { label: "Incomplet", color: muted },
};

function nf(n: number, digits = 0): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function buildExecutiveSummary(s: AnalyticsData["summary"], yearLabel: string): string {
  const verb =
    s.status === "ECONOMIE"
      ? "présente une économie globale"
      : s.status === "DEPASSEMENT"
      ? "est en dépassement"
      : "est conforme à l'objectif";
  const ecartAbs = Math.abs(s.deltaPercent);
  const sitesPart =
    s.sitesEnEconomie + s.sitesEnDepassement === 0
      ? ""
      : ` Sur ${s.totalSites} sites suivis, ${s.sitesEnEconomie} sont en économie et ${s.sitesEnDepassement} en dépassement.`;
  return `Sur ${yearLabel.toLowerCase()}, le portefeuille ${verb} de ${ecartAbs} % par rapport à la consommation théorique N′B (référentiel climatique).${sitesPart}`;
}

export function SynthesisDocument({ data }: { data: SynthesisPdfData }) {
  const { contractRef, contractTitle, contractProvider, yearLabel, analytics, activeAlerts } = data;
  const s = analytics.summary;
  const editedAt = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const sites = analytics.sites.filter((site) => site.nb != null);
  const exec = buildExecutiveSummary(s, yearLabel);

  return (
    <Document
      title={`Synthèse énergétique ${contractRef} ${yearLabel}`}
      author="MyXploit"
    >
      <Page size="A4" style={styles.page}>
        {/* Top metadata band */}
        <View style={styles.topMeta}>
          <Text>MyXploit · Rapport de suivi</Text>
          <Text>{yearLabel}</Text>
        </View>

        {/* Title block */}
        <Text style={styles.title}>Synthèse énergétique</Text>
        <Text style={styles.subtitle}>
          {contractRef} — {contractTitle}
        </Text>
        <Text style={styles.exploitant}>Exploitant : {contractProvider}</Text>

        <View style={styles.ruleStrong} />
        <View style={styles.ruleThin} />

        {/* Executive summary (1 paragraphe) */}
        <Text style={styles.execText}>{exec}</Text>

        {/* ── 1. KPIs ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionNum}>01</Text>
          <Text style={styles.sectionTitle}>Indicateurs globaux</Text>
        </View>

        <View style={styles.kpiStrip}>
          <View style={styles.kpiCol}>
            <Text style={styles.kpiLabel}>Conso. réelle (NC)</Text>
            <Text style={styles.kpiValue}>{nf(s.totalNc / 1000, 0)}</Text>
            <Text style={styles.kpiUnit}>MWh</Text>
          </View>
          <View style={styles.kpiColBordered}>
            <Text style={styles.kpiLabel}>Théorique (N&apos;B)</Text>
            <Text style={styles.kpiValue}>{nf(s.totalNbPrime / 1000, 0)}</Text>
            <Text style={styles.kpiUnit}>MWh</Text>
          </View>
          <View style={styles.kpiColBordered}>
            <Text style={styles.kpiLabel}>Écart NC / N&apos;B</Text>
            <Text
              style={{
                ...styles.kpiValue,
                color: s.deltaPercent <= 0 ? green : red,
              }}
            >
              {s.deltaPercent > 0 ? "+" : ""}
              {s.deltaPercent}%
            </Text>
            <Text style={styles.kpiUnit}>
              {s.status === "ECONOMIE"
                ? "Économie"
                : s.status === "DEPASSEMENT"
                ? "Dépassement"
                : "Objectif"}
            </Text>
          </View>
          <View style={styles.kpiColBordered}>
            <Text style={styles.kpiLabel}>Sites en économie</Text>
            <Text style={styles.kpiValue}>
              {s.sitesEnEconomie}
              <Text style={{ fontSize: 10, color: muted }}>
                {" / "}
                {s.totalSites}
              </Text>
            </Text>
            <Text style={styles.kpiUnit}>sur portefeuille</Text>
          </View>
          <View style={styles.kpiColBordered}>
            <Text style={styles.kpiLabel}>Sites en dépassement</Text>
            <Text
              style={{
                ...styles.kpiValue,
                color: s.sitesEnDepassement > 0 ? red : ink,
              }}
            >
              {s.sitesEnDepassement}
              <Text style={{ fontSize: 10, color: muted }}>
                {" / "}
                {s.totalSites}
              </Text>
            </Text>
            <Text style={styles.kpiUnit}>
              {s.sitesEnDepassement > 0 ? "à surveiller" : "aucune dérive"}
            </Text>
          </View>
        </View>

        {/* ── 2. Performance par site ── */}
        {sites.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionNum}>02</Text>
              <Text style={styles.sectionTitle}>Performance par site</Text>
            </View>

            <View style={styles.trHead}>
              <Text style={[styles.th, { flex: 3 }]}>Site</Text>
              <Text style={[styles.th, { flex: 1.1, textAlign: "right" }]}>NB</Text>
              <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>DJC</Text>
              <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>DJR</Text>
              <Text style={[styles.th, { flex: 1.2, textAlign: "right" }]}>NC</Text>
              <Text style={[styles.th, { flex: 1.2, textAlign: "right" }]}>N&apos;B</Text>
              <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Écart</Text>
              <Text style={[styles.th, { flex: 1.5, textAlign: "right" }]}>Statut</Text>
            </View>

            {sites.map((site) => {
              const sl = STATUS_TEXT[site.status] ?? STATUS_TEXT.OBJECTIF;
              const deltaColor =
                site.status === "INCOMPLET" ? muted : site.deltaPercent <= 0 ? green : red;
              return (
                <View key={site.siteId} style={styles.tr} wrap={false}>
                  <Text style={[styles.td, { flex: 3 }]}>{site.siteName}</Text>
                  <Text style={[styles.tdMono, { flex: 1.1, textAlign: "right" }]}>
                    {site.nb != null ? nf(site.nb) : "—"}
                  </Text>
                  <Text style={[styles.tdMono, { flex: 1, textAlign: "right", color: muted }]}>
                    {site._debug?.usedDjuc ?? "—"}
                  </Text>
                  <Text style={[styles.tdMono, { flex: 1, textAlign: "right", color: muted }]}>
                    {site._debug?.djrTotal ?? "—"}
                  </Text>
                  <Text style={[styles.tdMono, { flex: 1.2, textAlign: "right" }]}>
                    {nf(site.nc / 1000, 1)}
                  </Text>
                  <Text style={[styles.tdMono, { flex: 1.2, textAlign: "right", color: muted }]}>
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
                  <Text
                    style={[
                      styles.td,
                      {
                        flex: 1.5,
                        textAlign: "right",
                        color: sl.color,
                        fontFamily: site.status === "OBJECTIF" ? "Helvetica" : "Helvetica-Bold",
                      },
                    ]}
                  >
                    {sl.label}
                  </Text>
                </View>
              );
            })}

            {/* Totals */}
            <View style={styles.trTotal}>
              <Text style={[styles.td, { flex: 3, fontFamily: "Helvetica-Bold" }]}>Total</Text>
              <Text style={[styles.tdMono, { flex: 1.1, textAlign: "right" }]}>—</Text>
              <Text style={[styles.tdMono, { flex: 1, textAlign: "right" }]}>—</Text>
              <Text style={[styles.tdMono, { flex: 1, textAlign: "right" }]}>—</Text>
              <Text
                style={[
                  styles.tdMono,
                  { flex: 1.2, textAlign: "right", fontFamily: "Helvetica-Bold" },
                ]}
              >
                {nf(s.totalNc / 1000, 1)}
              </Text>
              <Text
                style={[
                  styles.tdMono,
                  { flex: 1.2, textAlign: "right", color: muted },
                ]}
              >
                {nf(s.totalNbPrime / 1000, 1)}
              </Text>
              <Text
                style={[
                  styles.tdMono,
                  {
                    flex: 1,
                    textAlign: "right",
                    color: s.deltaPercent <= 0 ? green : red,
                    fontFamily: "Helvetica-Bold",
                  },
                ]}
              >
                {s.deltaPercent > 0 ? "+" : ""}
                {s.deltaPercent}%
              </Text>
              <Text style={[styles.td, { flex: 1.5, textAlign: "right" }]} />
            </View>

            <Text style={styles.footnote}>
              Unités en MWh sauf indication. NB : objectif contractuel ; N&apos;B : objectif corrigé du climat
              (DJR/DJC) ; NC : consommation réelle constatée. Écart négatif = économie.
            </Text>
          </>
        )}

        {/* ── 3. Alertes ── */}
        {activeAlerts.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionNum}>03</Text>
              <Text style={styles.sectionTitle}>Alertes en cours ({activeAlerts.length})</Text>
            </View>

            {activeAlerts.slice(0, 10).map((alert, idx) => (
              <View key={alert.id} style={styles.alertRow} wrap={false}>
                <Text style={styles.alertNum}>{String(idx + 1).padStart(2, "0")}</Text>
                <View style={styles.alertBody}>
                  <View style={styles.alertHead}>
                    <Text style={styles.alertTitle}>{alert.title}</Text>
                    <Text style={styles.alertPriority}>{alert.priority}</Text>
                  </View>
                  <Text style={styles.alertMessage}>{alert.message}</Text>
                </View>
              </View>
            ))}
            {activeAlerts.length > 10 && (
              <Text style={styles.footnote}>
                + {activeAlerts.length - 10} autres alertes non listées dans ce rapport.
              </Text>
            )}
          </>
        )}

        {/* Footer fixed */}
        <View style={styles.footer} fixed>
          <Text>
            {contractRef} · {yearLabel} · Édité le {editedAt}
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
