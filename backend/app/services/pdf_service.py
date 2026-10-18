import io
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

from app.models.invoice import Invoice


def format_rupees(paise: int) -> str:
    """Format paise integer as Indian Rupees string (e.g. 5000 -> '50.00')."""
    sign = "-" if paise < 0 else ""
    abs_paise = abs(paise)
    rupees = abs_paise // 100
    remainder = abs_paise % 100
    return f"{sign}Rs. {rupees}.{remainder:02d}"


def generate_invoice_pdf(invoice: Invoice, store_name: str = "VisionCart AI Smart Retail") -> bytes:
    """Generate a clean, GST-compliant tax invoice PDF in memory using ReportLab."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#0f172a"),
        alignment=0,
    )
    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#475569"),
    )
    meta_label = ParagraphStyle(
        "MetaLabel",
        parent=styles["Normal"],
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#64748b"),
    )
    meta_val = ParagraphStyle(
        "MetaVal",
        parent=styles["Normal"],
        fontSize=9,
        leading=13,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#0f172a"),
    )
    cell_style = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#1e293b"),
    )
    cell_bold = ParagraphStyle(
        "TableCellBold",
        parent=cell_style,
        fontName="Helvetica-Bold",
    )
    header_cell = ParagraphStyle(
        "HeaderCell",
        parent=styles["Normal"],
        fontSize=8,
        leading=10,
        fontName="Helvetica-Bold",
        textColor=colors.white,
    )

    story = []

    # 1. Header Section
    header_data = [
        [
            Paragraph(f"<b>{store_name}</b>", title_style),
            Paragraph("<b>TAX INVOICE</b><br/><font size='8' color='#64748b'>ORIGINAL FOR RECIPIENT</font>", meta_val),
        ],
        [
            Paragraph(
                "GSTIN: <b>29AABCU9603R1ZM</b> | State Code: 29 (Karnataka)<br/>"
                "VisionCart Hub, Tech Corridor, Outer Ring Road, Bangalore - 560103",
                subtitle_style,
            ),
            Paragraph("", subtitle_style),
        ],
    ]
    header_table = Table(header_data, colWidths=[380, 160])
    header_table.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ])
    )
    story.append(header_table)
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#cbd5e1"), spaceAfter=10))

    # 2. Invoice Metadata Block
    created_str = (
        invoice.created_at.strftime("%d-%b-%Y %I:%M %p")
        if isinstance(invoice.created_at, datetime)
        else str(invoice.created_at)
    )
    cashier_display = invoice.cashier.full_name if invoice.cashier else f"ID: {invoice.cashier_id}"

    meta_data = [
        [
            Paragraph("Invoice Number:", meta_label),
            Paragraph(invoice.invoice_number, meta_val),
            Paragraph("Date & Time:", meta_label),
            Paragraph(created_str, meta_val),
        ],
        [
            Paragraph("Cashier:", meta_label),
            Paragraph(cashier_display, meta_val),
            Paragraph("Payment Status:", meta_label),
            Paragraph(f"<font color='#16a34a'><b>{invoice.status}</b></font>", meta_val),
        ],
    ]
    meta_table = Table(meta_data, colWidths=[90, 180, 90, 180])
    meta_table.setStyle(
        TableStyle([
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ])
    )
    story.append(meta_table)
    story.append(Spacer(1, 14))

    # 3. Itemized Tax Details Table
    items_header = [
        Paragraph("#", header_cell),
        Paragraph("Item / Description", header_cell),
        Paragraph("SKU", header_cell),
        Paragraph("Qty", header_cell),
        Paragraph("Price", header_cell),
        Paragraph("Taxable", header_cell),
        Paragraph("GST", header_cell),
        Paragraph("CGST", header_cell),
        Paragraph("SGST", header_cell),
        Paragraph("Total", header_cell),
    ]

    table_rows = [items_header]
    for idx, item in enumerate(invoice.items, start=1):
        half_gst = item.gst_rate / 2.0
        row = [
            Paragraph(str(idx), cell_style),
            Paragraph(item.product_name, cell_style),
            Paragraph(item.product_sku, cell_style),
            Paragraph(str(item.quantity), cell_style),
            Paragraph(format_rupees(item.unit_price_paise), cell_style),
            Paragraph(format_rupees(item.taxable_value_paise), cell_style),
            Paragraph(f"{item.gst_rate}%", cell_style),
            Paragraph(f"{half_gst:.1f}%<br/>{format_rupees(item.cgst_paise)}", cell_style),
            Paragraph(f"{half_gst:.1f}%<br/>{format_rupees(item.sgst_paise)}", cell_style),
            Paragraph(f"<b>{format_rupees(item.line_total_paise)}</b>", cell_style),
        ]
        table_rows.append(row)

    col_widths = [20, 140, 65, 25, 52, 56, 32, 50, 50, 50]
    items_table = Table(table_rows, colWidths=col_widths, repeatRows=1)
    items_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 3),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ])
    )
    story.append(items_table)
    story.append(Spacer(1, 10))

    # 4. Totals & Tax Breakup Summary
    summary_data = [
        [Paragraph("Taxable Value Subtotal:", cell_bold), Paragraph(format_rupees(invoice.subtotal_paise), cell_style)],
        [Paragraph("Central GST (CGST Total):", cell_bold), Paragraph(format_rupees(invoice.cgst_paise), cell_style)],
        [Paragraph("State GST (SGST Total):", cell_bold), Paragraph(format_rupees(invoice.sgst_paise), cell_style)],
        [Paragraph("Rounding Adjustment:", cell_bold), Paragraph(format_rupees(invoice.rounding_paise), cell_style)],
        [
            Paragraph("<font size='10'><b>Grand Total Payable:</b></font>", cell_bold),
            Paragraph(f"<font size='10' color='#15803d'><b>{format_rupees(invoice.total_paise)}</b></font>", cell_bold),
        ],
    ]
    summary_table = Table(summary_data, colWidths=[160, 100])
    summary_table.setStyle(
        TableStyle([
            ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LINEABOVE", (0, -1), (-1, -1), 1, colors.HexColor("#0f172a")),
            ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#f0fdf4")),
        ])
    )

    # Wrap summary in a container aligned to right
    summary_container = Table(
        [[Paragraph("", cell_style), summary_table]],
        colWidths=[280, 260]
    )
    summary_container.setStyle(
        TableStyle([
            ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ])
    )
    story.append(summary_container)
    story.append(Spacer(1, 20))

    # 5. Statutory Declaration & Footer
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1"), spaceAfter=8))
    footer_text = Paragraph(
        "<font size='7' color='#64748b'>"
        "Declaration: This is a computer-generated tax invoice issued in accordance with GST Rules. "
        "No signature is required. Thank you for shopping with VisionCart AI."
        "</font>",
        ParagraphStyle("Footer", parent=styles["Normal"], alignment=1),
    )
    story.append(footer_text)

    # Build PDF
    doc.build(story)
    return buffer.getvalue()

