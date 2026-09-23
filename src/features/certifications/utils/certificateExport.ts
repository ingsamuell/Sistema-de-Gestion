// Utilidades para exportación de diplomas y certificaciones en alta resolución

export async function captureCertificateCanvas(elementId: string): Promise<HTMLCanvasElement | null> {
  if (typeof window === 'undefined') return null;
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`captureCertificateCanvas: No se encontró el elemento #${elementId}`);
    return null;
  }

  const html2canvas = (await import('html2canvas')).default;

  return await html2canvas(element, {
    scale: 2.5, // Alta resolución para nitidez en impresión y visualización
    useCORS: true,
    backgroundColor: '#FFFDF9',
    logging: false,
    allowTaint: true,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });
}

/**
 * Exporta el diploma como PDF en formato apaisado (A4 Landscape)
 */
export async function exportCertificateAsPDF(elementId: string, filename: string): Promise<boolean> {
  try {
    const canvas = await captureCertificateCanvas(elementId);
    if (!canvas) return false;

    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = await import('jspdf');

    // A4 Landscape: 841.89 pt x 595.28 pt
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Calcular proporciones manteniendo relación de aspecto dentro del marco A4 con margen
    const margin = 24;
    const availableWidth = pageWidth - margin * 2;
    const availableHeight = pageHeight - margin * 2;

    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(availableWidth / imgWidth, availableHeight / imgHeight);

    const finalWidth = imgWidth * ratio;
    const finalHeight = imgHeight * ratio;

    const xPos = margin + (availableWidth - finalWidth) / 2;
    const yPos = margin + (availableHeight - finalHeight) / 2;

    pdf.addImage(imgData, 'PNG', xPos, yPos, finalWidth, finalHeight, undefined, 'FAST');
    pdf.save(`${filename.replace(/[/\\?%*:|"<>]/g, '_')}.pdf`);

    return true;
  } catch (error) {
    console.error('Error al exportar certificado a PDF:', error);
    return false;
  }
}

/**
 * Exporta el diploma como imagen PNG en alta definición
 */
export async function exportCertificateAsPNG(elementId: string, filename: string): Promise<boolean> {
  try {
    const canvas = await captureCertificateCanvas(elementId);
    if (!canvas) return false;

    const imgData = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = imgData;
    link.download = `${filename.replace(/[/\\?%*:|"<>]/g, '_')}.png`;
    link.click();
    return true;
  } catch (error) {
    console.error('Error al exportar certificado a PNG:', error);
    return false;
  }
}

/**
 * Prepara la ventana de impresión para el certificado
 */
export async function printCertificate(elementId: string): Promise<void> {
  const canvas = await captureCertificateCanvas(elementId);
  if (!canvas) {
    window.print();
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.print();
    return;
  }

  const imgData = canvas.toDataURL('image/png');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Imprimir Certificación - Komorebi Study Studio</title>
        <style>
          @page {
            size: landscape;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: #ffffff;
          }
          img {
            max-width: 100vw;
            max-height: 100vh;
            object-fit: contain;
          }
        </style>
      </head>
      <body>
        <img src="${imgData}" onload="window.print(); window.close();" />
      </body>
    </html>
  `);
  printWindow.document.close();
}
