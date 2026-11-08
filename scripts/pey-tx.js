import "dotenv/config";
import { listTransactions } from "../src/pey/client.js";

function datePaidIso(value) {
  if (!value) return null;
  const numeric = Number(value);
  const date = Number.isFinite(numeric)
    ? new Date(numeric < 1_000_000_000_000 ? numeric * 1000 : numeric)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

if (!process.env.PEY_API_KEY) {
  console.error("Falta PEY_API_KEY. Configúrala para consultar las transacciones de pey.");
  process.exitCode = 1;
} else {
  try {
    const { items } = await listTransactions();
    console.table(items.slice(0, 10).map((tx) => ({
      id: tx.id,
      status: tx.status,
      payableType: tx.payableType,
      payableId: tx.payableId,
      amount: tx.amountBreakdown?.base ?? tx.amount,
      datePaid: datePaidIso(tx.datePaid),
      chargeId: tx.metadata?.externalMetadata?.chargeId ?? tx.metadata?.chargeId,
    })));
  } catch (error) {
    console.error(`No pude consultar transacciones de pey: ${error.message}`);
    process.exitCode = 1;
  }
}
