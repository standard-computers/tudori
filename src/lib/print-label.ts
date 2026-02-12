import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';

export interface LabelItem {
  productId: string;
  productName: string;
  sku: string | null;
  bin: string | null;
  area: string | null;
  quantity: number;
  puNumber: string | null;
}

/**
 * Generate a barcode as a base64 data URL using a hidden canvas.
 */
function generateBarcodeDataUrl(value: string): string {
  const canvas = document.createElement('canvas');
  try {
    JsBarcode(canvas, value, {
      format: 'CODE128',
      width: 2,
      height: 50,
      displayValue: false,
      margin: 0,
    });
  } catch {
    // If barcode generation fails (invalid chars), return empty
    return '';
  }
  return canvas.toDataURL('image/png');
}

/**
 * Generate inventory labels as a PDF with each label on its own page,
 * sized to a standard label scroll format (100mm x 50mm per label).
 * Downloads the PDF directly.
 */
export function printInventoryLabels(items: LabelItem[]) {
  if (items.length === 0) return;

  // Label dimensions in mm (4" x 2" approx)
  const labelW = 100;
  const labelH = 50;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [labelW, labelH] });

  items.forEach((item, index) => {
    if (index > 0) {
      doc.addPage([labelW, labelH], 'landscape');
    }

    // Product Name (bold, larger)
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    const name = item.productName.length > 35 ? item.productName.substring(0, 35) + '…' : item.productName;
    doc.text(name, 3, 7);

    // Product ID & SKU
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    let idLine = `ID: ${item.productId}`;
    if (item.sku) idLine += `  |  SKU: ${item.sku}`;
    doc.text(idLine, 3, 13);

    // Location info
    let locLine = '';
    if (item.area) locLine += `Area: ${item.area}`;
    if (item.bin) locLine += `${locLine ? '  |  ' : ''}Bin: ${item.bin}`;
    if (locLine) {
      doc.text(locLine, 3, 18);
    }

    // Quantity & PU
    let qtyLine = `Qty: ${item.quantity}`;
    if (item.puNumber) qtyLine += `  |  PU: ${item.puNumber}`;
    doc.setFont('helvetica', 'bold');
    doc.text(qtyLine, 3, 23);

    // Barcode - use PU number if assigned, otherwise Product ID
    const barcodeValue = item.puNumber || item.productId;
    const barcodeUrl = generateBarcodeDataUrl(barcodeValue);
    if (barcodeUrl) {
      try {
        doc.addImage(barcodeUrl, 'PNG', 10, 27, 80, 15);
        // Barcode text below
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(barcodeValue, labelW / 2, 46, { align: 'center' });
      } catch {
        doc.setFontSize(8);
        doc.text(barcodeValue, 3, 35);
      }
    }
  });

  // Download as PDF
  doc.save(`inventory-labels-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * Print a single location label (area or bin) as a 100mm x 50mm PDF.
 * Shows the name prominently and uses the ID as the barcode value.
 */
export function printLocationLabel(type: 'Area' | 'Bin', id: string, name: string) {
  const labelW = 100;
  const labelH = 50;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [labelW, labelH] });

  // Type badge
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(type, 3, 7);

  // Name (bold, large)
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const displayName = name.length > 28 ? name.substring(0, 28) + '…' : name;
  doc.text(displayName, 3, 15);

  // ID
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`ID: ${id}`, 3, 22);

  // Barcode of the ID
  const barcodeUrl = generateBarcodeDataUrl(id);
  if (barcodeUrl) {
    try {
      doc.addImage(barcodeUrl, 'PNG', 10, 27, 80, 15);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(id, labelW / 2, 46, { align: 'center' });
    } catch {
      doc.setFontSize(8);
      doc.text(id, 3, 35);
    }
  }

  doc.save(`${type.toLowerCase()}-label-${id}.pdf`);
}
