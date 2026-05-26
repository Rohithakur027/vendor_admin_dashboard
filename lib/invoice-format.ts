export function formatInvoiceNumber(invoiceNumber: string) {
  return invoiceNumber.replace(/^VINV-/, "INV-");
}
