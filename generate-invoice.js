import Stripe from 'stripe';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Load .env manually (no dotenv dependency needed)
// ---------------------------------------------------------------------------
try {
  const envPath = resolve(process.cwd(), '.env');
  const envFile = readFileSync(envPath, 'utf-8');
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const val = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // .env is optional if the key is already in the environment
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_KEY) {
  console.error('ERROR: STRIPE_SECRET_KEY is not set.');
  console.error('Create a .env file with: STRIPE_SECRET_KEY=sk_live_...');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_KEY);

// ---------------------------------------------------------------------------
// Line items that match the proposal
// ---------------------------------------------------------------------------
const PRODUCTS = {
  website: {
    name: 'Local SEO Website (40-Page Build)',
    description: 'Custom 40-page local SEO site for all 5 Pro Wash locations. Includes Schema markup, location pages, and 30 days SEO support.',
    price: 50000, // in cents
  },
  store: {
    name: 'Affiliate Fundraiser Store',
    description: 'E-commerce storefront with affiliate fundraiser system. Custom fundraiser pages, real-time commission tracking, and embedded checkout.',
    price: 27500,
  },
  email: {
    name: 'Private Email Platform (Mailchimp Replacement)',
    description: 'Self-hosted email marketing platform. 50k emails/mo capacity, visual template builder, open & click tracking. Deployed on your domain.',
    price: 75000,
  },
  support: {
    name: 'Priority Support Retainer',
    description: 'Monthly maintenance: minor updates, server & plugin upkeep, priority email support. Cancel anytime.',
    price: 7500,
    recurring: { interval: 'month' },
  },
};

// ---------------------------------------------------------------------------
// Parse CLI args: node generate-invoice.js [items...] [--email <email>] [--name <name>] [--send] [--draft]
// ---------------------------------------------------------------------------
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    items: [],
    email: null,
    name: 'Pro Wash',
    send: false,
    draft: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--email' && args[i + 1]) {
      result.email = args[++i];
    } else if (arg === '--name' && args[i + 1]) {
      result.name = args[++i];
    } else if (arg === '--send') {
      result.send = true;
    } else if (arg === '--draft') {
      result.draft = true;
    } else if (arg === '--all') {
      result.items = Object.keys(PRODUCTS);
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (PRODUCTS[arg]) {
      result.items.push(arg);
    } else {
      console.error(`Unknown argument: ${arg}`);
      printHelp();
      process.exit(1);
    }
  }

  if (result.items.length === 0) {
    // Default: all one-time items (no support retainer)
    result.items = ['website', 'store', 'email'];
  }

  return result;
}

function printHelp() {
  console.log(`
Pro Wash — Stripe Invoice Generator

Usage:
  node generate-invoice.js [items...] [options]

Items (pick any combination):
  website     Local SEO Website           $500
  store       Affiliate Fundraiser Store   $275
  email       Private Email Platform       $750
  support     Priority Support Retainer    $75/mo

Options:
  --all              Include all items
  --email <email>    Customer email (required for --send)
  --name  <name>     Customer name (default: "Pro Wash")
  --send             Finalize and email the invoice to the customer
  --draft            Create as draft only (don't finalize)
  --help             Show this help

Examples:
  node generate-invoice.js --all --email owner@prowash.com --send
  node generate-invoice.js website store --email owner@prowash.com --send
  node generate-invoice.js email --draft
  `);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const opts = parseArgs();

  if (opts.send && !opts.email) {
    console.error('ERROR: --send requires --email <address>');
    process.exit(1);
  }

  console.log('=== Pro Wash Invoice Generator ===\n');

  // 1. Create or find customer
  console.log(`Customer: ${opts.name}`);
  let customer;
  if (opts.email) {
    const existing = await stripe.customers.list({ email: opts.email, limit: 1 });
    if (existing.data.length > 0) {
      customer = existing.data[0];
      console.log(`  Found existing customer: ${customer.id}`);
    } else {
      customer = await stripe.customers.create({
        name: opts.name,
        email: opts.email,
        metadata: { source: 'prowash-proposal' },
      });
      console.log(`  Created new customer: ${customer.id}`);
    }
  } else {
    customer = await stripe.customers.create({
      name: opts.name,
      metadata: { source: 'prowash-proposal' },
    });
    console.log(`  Created customer (no email): ${customer.id}`);
  }

  // 2. Create products and prices, then attach invoice items
  const oneTimeItems = [];
  const recurringItems = [];

  for (const key of opts.items) {
    const item = PRODUCTS[key];

    // Create a product
    const product = await stripe.products.create({
      name: item.name,
      description: item.description,
      metadata: { proposal_item: key },
    });

    // Create a price
    const priceParams = {
      product: product.id,
      unit_amount: item.price,
      currency: 'usd',
    };

    if (item.recurring) {
      priceParams.recurring = item.recurring;
      recurringItems.push({ key, item, priceParams });
    } else {
      priceParams.recurring = undefined; // one-time
      oneTimeItems.push({ key, item, priceParams });
    }
  }

  // 3. Create invoice items for one-time charges
  for (const { key, item, priceParams } of oneTimeItems) {
    const price = await stripe.prices.create(priceParams);
    await stripe.invoiceItems.create({
      customer: customer.id,
      price: price.id,
      description: item.description,
    });
    console.log(`  + ${item.name} — $${(item.price / 100).toFixed(0)}`);
  }

  // 4. Build invoice params
  const invoiceParams = {
    customer: customer.id,
    collection_method: 'send_invoice',
    days_until_due: 7,
    metadata: {
      proposal: 'Pro Wash Digital Growth Package',
      generated_by: 'TaggleFish',
    },
    custom_fields: [
      { name: 'Prepared by', value: 'TaggleFish' },
      { name: 'Project', value: 'Digital Growth Package' },
    ],
  };

  // If there are recurring items, we need a subscription instead
  // But for simplicity, we add the recurring price as an invoice item too
  // and note it in the description
  for (const { key, item, priceParams } of recurringItems) {
    // For the first invoice, add as a one-time line with note
    await stripe.invoiceItems.create({
      customer: customer.id,
      unit_amount: item.price,
      currency: 'usd',
      description: `${item.name} — First month ($${(item.price / 100).toFixed(0)}/mo recurring)`,
    });
    console.log(`  + ${item.name} — $${(item.price / 100).toFixed(0)}/mo`);
  }

  // 5. Create the invoice
  const invoice = await stripe.invoices.create(invoiceParams);
  console.log(`\nInvoice created: ${invoice.id}`);

  // 6. Finalize or leave as draft
  if (opts.draft) {
    console.log('Status: DRAFT (not finalized)');
    console.log(`Dashboard: https://dashboard.stripe.com/invoices/${invoice.id}`);
  } else {
    const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
    console.log(`Status: FINALIZED`);
    console.log(`Invoice URL: ${finalized.hosted_invoice_url}`);
    console.log(`PDF: ${finalized.invoice_pdf}`);

    // 7. Send if requested
    if (opts.send) {
      await stripe.invoices.sendInvoice(invoice.id);
      console.log(`\nInvoice SENT to ${opts.email}`);
    } else {
      console.log(`\nInvoice ready. Use --send to email it, or share the URL above.`);
    }
  }

  // Summary
  const totalOneTime = opts.items
    .filter(k => !PRODUCTS[k].recurring)
    .reduce((sum, k) => sum + PRODUCTS[k].price, 0);
  const totalMonthly = opts.items
    .filter(k => PRODUCTS[k].recurring)
    .reduce((sum, k) => sum + PRODUCTS[k].price, 0);

  console.log(`\n--- Summary ---`);
  console.log(`One-time total: $${(totalOneTime / 100).toFixed(0)}`);
  if (totalMonthly > 0) {
    console.log(`Monthly recurring: $${(totalMonthly / 100).toFixed(0)}/mo`);
  }
  console.log('================\n');
}

main().catch((err) => {
  console.error('Stripe error:', err.message);
  process.exit(1);
});
