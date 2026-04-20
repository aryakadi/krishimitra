"""
AgriSmart AI — PDF Report Generation Service
=============================================
Generates professional PDF reports using ReportLab.
Reports include prediction summaries, Snowflake analytics, and comparison tables.
"""

import io
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        HRFlowable, KeepTogether
    )
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False
    logger.warning("reportlab not installed. PDF reports disabled. pip install reportlab")


# ─── Colour Palette ───────────────────────────────────────────────────────────
GREEN_DARK   = colors.HexColor("#1a5c2a")
GREEN_MED    = colors.HexColor("#2d8a46")
GREEN_LIGHT  = colors.HexColor("#e8f5e9")
ACCENT_BLUE  = colors.HexColor("#1565c0")
SNOW_BLUE    = colors.HexColor("#29b5e8")   # Snowflake brand colour
LIGHT_GRAY   = colors.HexColor("#f5f5f5")
BORDER_GRAY  = colors.HexColor("#cccccc")
TEXT_DARK    = colors.HexColor("#212121")
TEXT_GRAY    = colors.HexColor("#616161")
WHITE        = colors.white


def _get_styles():
    """Return custom paragraph styles."""
    base = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "ReportTitle",
        parent=base["Title"],
        fontSize=22,
        textColor=WHITE,
        alignment=TA_CENTER,
        spaceAfter=4,
        fontName="Helvetica-Bold",
    )
    subtitle_style = ParagraphStyle(
        "ReportSubtitle",
        parent=base["Normal"],
        fontSize=11,
        textColor=colors.HexColor("#b2dfdb"),
        alignment=TA_CENTER,
        spaceAfter=0,
    )
    section_header = ParagraphStyle(
        "SectionHeader",
        parent=base["Heading2"],
        fontSize=13,
        textColor=GREEN_DARK,
        spaceBefore=14,
        spaceAfter=6,
        fontName="Helvetica-Bold",
        borderPad=2,
    )
    body_style = ParagraphStyle(
        "Body",
        parent=base["Normal"],
        fontSize=10,
        textColor=TEXT_DARK,
        leading=14,
    )
    small_style = ParagraphStyle(
        "Small",
        parent=base["Normal"],
        fontSize=8,
        textColor=TEXT_GRAY,
        leading=11,
    )
    highlight = ParagraphStyle(
        "Highlight",
        parent=base["Normal"],
        fontSize=10,
        textColor=ACCENT_BLUE,
        fontName="Helvetica-Bold",
        leading=13,
    )
    return {
        "title": title_style, "subtitle": subtitle_style,
        "section": section_header, "body": body_style,
        "small": small_style, "highlight": highlight,
    }


def _header_band(styles, user_name: str, report_date: str) -> list:
    """Generate the green header banner with branding."""
    header_table = Table(
        [[
            Paragraph("🌾 AgriSmart AI", styles["title"]),
            Paragraph(f"Data Warehouse Intelligence Report<br/><font size=9>{report_date}</font>",
                      styles["subtitle"]),
        ]],
        colWidths=["45%", "55%"]
    )
    header_table.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), GREEN_DARK),
        ("ROWBACKGROUNDS",(0,0), (-1,-1), [GREEN_DARK]),
        ("LEFTPADDING",  (0, 0), (-1, -1), 16),
        ("RIGHTPADDING", (0, 0), (-1, -1), 16),
        ("TOPPADDING",   (0, 0), (-1, -1), 18),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 18),
        ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
    ]))

    user_info = Table(
        [[Paragraph(f"<b>Prepared for:</b> {user_name} &nbsp;&nbsp; <b>System:</b> Snowflake ADBMS v2.0 ❄️",
                    ParagraphStyle("ui", fontSize=9, textColor=TEXT_GRAY))]],
        colWidths=["100%"]
    )
    user_info.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), LIGHT_GRAY),
        ("LEFTPADDING",  (0, 0), (-1, -1), 16),
        ("TOPPADDING",   (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 6),
    ]))
    return [header_table, user_info, Spacer(1, 0.4 * cm)]


def _section(text: str, styles) -> Paragraph:
    return Paragraph(f"◆ {text}", styles["section"])


def _kpi_row(labels_values: list, styles) -> Table:
    """Build a row of KPI cards."""
    cols  = len(labels_values)
    data  = [[Paragraph(f"<b>{v}</b><br/><font size=8>{l}</font>",
                        ParagraphStyle("kpi", fontSize=14, textColor=GREEN_DARK,
                                       fontName="Helvetica-Bold", alignment=TA_CENTER,
                                       leading=18))
              for l, v in labels_values]]
    tbl   = Table(data, colWidths=[f"{100 // cols}%" for _ in labels_values])
    tbl.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), GREEN_LIGHT),
        ("BOX",          (0, 0), (-1, -1), 1, GREEN_MED),
        ("INNERGRID",    (0, 0), (-1, -1), 0.5, GREEN_MED),
        ("ALIGN",        (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING",   (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 10),
        ("ROWBACKGROUNDS",(0,0), (-1, -1), [GREEN_LIGHT]),
    ]))
    return tbl


def _data_table(headers: list, rows: list, styles) -> Table:
    """Build a formatted data table."""
    header_row = [Paragraph(f"<b>{h}</b>", ParagraphStyle(
        "TH", fontSize=9, textColor=WHITE, fontName="Helvetica-Bold", alignment=TA_CENTER
    )) for h in headers]

    body_rows = []
    for i, row in enumerate(rows):
        body_rows.append([
            Paragraph(str(cell), ParagraphStyle(
                "TD", fontSize=9, textColor=TEXT_DARK, alignment=TA_CENTER
            )) for cell in row
        ])

    all_rows = [header_row] + body_rows
    col_w = f"{100 // len(headers)}%"
    tbl = Table(all_rows, colWidths=[col_w] * len(headers), repeatRows=1)
    tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0), GREEN_MED),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [WHITE, LIGHT_GRAY]),
        ("BOX",           (0, 0), (-1, -1), 0.8, BORDER_GRAY),
        ("INNERGRID",     (0, 0), (-1, -1), 0.4, BORDER_GRAY),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
    ]))
    return tbl


def _snowflake_banner(styles) -> Table:
    """Snowflake attribution banner."""
    tbl = Table([[
        Paragraph("❄️  Powered by <b>Snowflake Data Cloud</b> — Star Schema · Materialized Views · Time Travel",
                  ParagraphStyle("sf", fontSize=9, textColor=SNOW_BLUE,
                                 fontName="Helvetica-Bold", alignment=TA_CENTER))
    ]], colWidths=["100%"])
    tbl.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), colors.HexColor("#e3f2fd")),
        ("BOX",          (0, 0), (-1, -1), 1, SNOW_BLUE),
        ("TOPPADDING",   (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 7),
    ]))
    return tbl


def generate_report(
    user_name: str,
    prediction_results: Optional[dict] = None,
    include_crop_trends: bool = True,
    include_disease_trends: bool = True,
    include_yield_comparison: bool = True,
    include_feedback: bool = True,
    analytics_summary: Optional[dict] = None,
    crop_trends: Optional[list] = None,
    disease_trends: Optional[list] = None,
    yield_comparison: Optional[list] = None,
    feedback_summary: Optional[dict] = None,
) -> bytes:
    """
    Generate a professional PDF report and return as bytes.
    Falls back to a minimal text report if ReportLab is not installed.
    """
    if not REPORTLAB_AVAILABLE:
        # Minimal plain-text fallback
        content = (
            f"AgriSmart AI Report\n"
            f"User: {user_name}\n"
            f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n"
            f"Install reportlab for rich PDF: pip install reportlab\n"
        )
        return content.encode("utf-8")

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=1.5 * cm, rightMargin=1.5 * cm,
        topMargin=1.5 * cm, bottomMargin=1.5 * cm,
        title="AgriSmart AI Analytics Report"
    )

    styles   = _get_styles()
    elements = []
    now      = datetime.now().strftime("%d %B %Y, %H:%M IST")

    # ── Header ────────────────────────────────────────────────────────────────
    elements.extend(_header_band(styles, user_name, now))

    # ── Snowflake Banner ──────────────────────────────────────────────────────
    elements.append(_snowflake_banner(styles))
    elements.append(Spacer(1, 0.4 * cm))

    # ── Executive Summary KPIs ────────────────────────────────────────────────
    elements.append(_section("Executive Summary", styles))
    smry = analytics_summary or {}
    elements.append(_kpi_row([
        ("Total Predictions",  str(smry.get("total_predictions", "—"))),
        ("System Accuracy",    f"{smry.get('accuracy_pct', '—')}%"),
        ("Snowflake Status",   "✅ Live" if smry.get("snowflake_connected") else "⚠ Mock"),
        ("Report Date",        datetime.now().strftime("%d %b %Y")),
    ], styles))
    elements.append(Spacer(1, 0.3 * cm))

    # ── Prediction Results ────────────────────────────────────────────────────
    if prediction_results:
        elements.append(_section("Prediction Results", styles))
        ptype = prediction_results.get("prediction_type", "General Prediction")
        elements.append(Paragraph(f"<b>Prediction Type:</b> {ptype.replace('_',' ').title()}", styles["body"]))
        elements.append(Spacer(1, 0.2 * cm))
        rows = [[k.replace("_", " ").title(), str(v)]
                for k, v in prediction_results.items() if k != "prediction_type"]
        if rows:
            elements.append(_data_table(["Parameter", "Value"], rows, styles))
        elements.append(Spacer(1, 0.2 * cm))

    # ── Top Crops ─────────────────────────────────────────────────────────────
    if include_crop_trends:
        elements.append(_section("Top Recommended Crops (Snowflake OLAP)", styles))
        top_crops = (analytics_summary or {}).get("top_crops", [])
        if top_crops:
            rows = [[i + 1, c["crop"], c["count"]] for i, c in enumerate(top_crops)]
            elements.append(_data_table(["Rank", "Crop", "Recommendations"], rows, styles))
        else:
            elements.append(Paragraph("No crop data available.", styles["small"]))
        elements.append(Spacer(1, 0.2 * cm))

    # ── Disease Trends ────────────────────────────────────────────────────────
    if include_disease_trends:
        elements.append(_section("Disease Frequency Analysis (from MV_DISEASE_FREQ)", styles))
        top_diseases = (analytics_summary or {}).get("top_diseases", [])
        if top_diseases:
            rows = [[i + 1, d["name"], d["count"]] for i, d in enumerate(top_diseases)]
            elements.append(_data_table(["Rank", "Disease", "Detections"], rows, styles))
        else:
            elements.append(Paragraph("No disease data available.", styles["small"]))
        elements.append(Spacer(1, 0.2 * cm))

    # ── Yield Comparison ──────────────────────────────────────────────────────
    if include_yield_comparison and yield_comparison:
        elements.append(_section("Yield Comparison Across Regions (from MV_YIELD_COMPARISON)", styles))
        rows = [
            [y["crop_name"], y["region"], y["season"],
             f"{y['avg_yield']:.2f}", f"{y['min_yield']:.2f}", f"{y['max_yield']:.2f}"]
            for y in yield_comparison[:8]
        ]
        if rows:
            elements.append(_data_table(
                ["Crop", "Region", "Season", "Avg Yield", "Min", "Max"], rows, styles
            ))
        elements.append(Spacer(1, 0.2 * cm))

    # ── Feature Usage ─────────────────────────────────────────────────────────
    elements.append(_section("Feature Usage Statistics", styles))
    usage = (analytics_summary or {}).get("feature_usage", [])
    if usage:
        rows = [[f["feature"], f["uses"]] for f in usage]
        elements.append(_data_table(["Feature", "Total Uses"], rows, styles))
    elements.append(Spacer(1, 0.2 * cm))

    # ── Feedback Loop ─────────────────────────────────────────────────────────
    if include_feedback and feedback_summary:
        elements.append(_section("Feedback Loop — Predicted vs Actual", styles))
        fb = feedback_summary
        elements.append(Paragraph(
            f"Total predictions with feedback: <b>{fb.get('with_feedback', 0)}</b> / "
            f"{fb.get('total_predictions', 0)} &nbsp;|&nbsp; "
            f"Overall Model Accuracy: <b>{fb.get('overall_accuracy_pct', 'N/A')}%</b>",
            styles["highlight"]
        ))
        elements.append(Spacer(1, 0.15 * cm))
        acc_data = fb.get("accuracy", {})
        if acc_data:
            rows = [
                [ptype.replace("_", " ").title(), info.get("count", 0),
                 info.get("with_feedback", info.get("accuracy_pct", "N/A")),
                 f"{info.get('accuracy_pct', 'N/A')}%"]
                for ptype, info in acc_data.items()
            ]
            elements.append(_data_table(["Prediction Type", "Total", "With Feedback", "Accuracy"], rows, styles))

    # ── Snowflake Architecture Note ───────────────────────────────────────────
    elements.append(Spacer(1, 0.5 * cm))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_GRAY))
    elements.append(Spacer(1, 0.2 * cm))
    elements.append(Paragraph(
        "<b>Data Architecture:</b> Star Schema (5 Dimension + 3 Core Fact Tables) · "
        "Materialized Views (MV_CROP_TRENDS, MV_DISEASE_FREQ, MV_YIELD_COMPARISON) · "
        "Snowflake Time Travel · CDC Streams · Scheduled Tasks",
        ParagraphStyle("footer", fontSize=8, textColor=TEXT_GRAY, leading=11)
    ))
    elements.append(Paragraph(
        f"Generated by AgriSmart AI v2.0 — ADBMS Final Year Project | {now}",
        ParagraphStyle("footer2", fontSize=8, textColor=TEXT_GRAY, alignment=TA_CENTER)
    ))

    doc.build(elements)
    return buffer.getvalue()
