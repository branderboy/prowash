import Stripe from 'stripe';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return res.status(500).json({ error: 'Stripe key not configured' });
  }

  const stripe = new Stripe(secretKey);

  try {
    const { items, clientName, clientEmail, websiteTier } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items selected' });
    }

    // Product catalog — prices in cents
    const catalog = {
      website: {
        html: {
          name: 'Local SEO Website — HTML + PHP (40 Pages)',
          price: 50000,
          description: '40-page local SEO site. HTML/CSS + PHP. Schema markup, location pages, 30 days SEO support.',
        },
        cms: {
          name: 'Local SEO Website — Custom CMS / Next.js (40 Pages)',
          price: 97800,
          description: '40-page local SEO site with custom Next.js CMS. Visual editor, blog, content management.',
        },
      },
      store: {
        name: 'Affiliate Fundraiser Store',
        price: 27500,
        description: 'E-commerce storefront with affiliate fundraiser system. Stripe checkout, commission tracking.',
      },
      email: {
        name: 'Private Email Platform (Mailchimp Replacement)',
        price: 75000,
        description: 'Self-hosted email marketing. 50k emails/mo via Amazon SES. Template builder, analytics.',
      },
      support: {
        name: 'Priority Support Retainer',
        price: 7500,
        description: 'Monthly maintenance, server upkeep, priority email support. Cancel with 30 days notice.',
        recurring: true,
      },
    };

    const lineItems = [];
    let hasRecurring = false;

    for (const itemKey of items) {
      if (itemKey === 'website') {
        const tier = websiteTier === 'cms' ? 'cms' : 'html';
        const product = catalog.website[tier];
        // 50% deposit
        const depositAmount = Math.round(product.price / 2);
        lineItems.push({
          price_data: {
            currency: 'usd',
            product_data: {
              name: product.name + ' — 50% Deposit',
              description: product.description,
            },
            unit_amount: depositAmount,
          },
          quantity: 1,
        });
      } else if (itemKey === 'support') {
        // Recurring — create as subscription
        hasRecurring = true;
        lineItems.push({
          price_data: {
            currency: 'usd',
            product_data: {
              name: catalog.support.name,
              description: catalog.support.description,
            },
            unit_amount: catalog.support.price,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        });
      } else if (catalog[itemKey]) {
        const product = catalog[itemKey];
        // 50% deposit
        const depositAmount = Math.round(product.price / 2);
        lineItems.push({
          price_data: {
            currency: 'usd',
            product_data: {
              name: product.name + ' — 50% Deposit',
              description: product.description,
            },
            unit_amount: depositAmount,
          },
          quantity: 1,
        });
      }
    }

    if (lineItems.length === 0) {
      return res.status(400).json({ error: 'No valid items' });
    }

    // Determine mode
    const mode = hasRecurring ? 'subscription' : 'payment';

    // Build session params
    const sessionParams = {
      mode,
      line_items: lineItems,
      success_url: `${req.headers.origin || 'https://prowash.vercel.app'}?payment=success`,
      cancel_url: `${req.headers.origin || 'https://prowash.vercel.app'}?payment=cancelled`,
      payment_method_types: ['card'],
      metadata: {
        client_name: clientName || '',
        proposal: 'Pro Wash Digital Growth Package',
        generated_by: 'TaggleFish',
      },
    };

    // Add customer email if provided
    if (clientEmail) {
      sessionParams.customer_email = clientEmail;
    }

    // If mixing one-time + recurring, use subscription mode
    // Stripe handles one-time items in subscription mode as invoice items
    if (hasRecurring && mode === 'subscription') {
      // For subscription mode, Stripe requires all line items to have recurring
      // So split: create one-time items separately
      const recurringItems = lineItems.filter(li => li.price_data.recurring);
      const oneTimeItems = lineItems.filter(li => !li.price_data.recurring);

      if (oneTimeItems.length > 0 && recurringItems.length > 0) {
        // Use payment mode for one-time items only
        // Support retainer can be added later via separate checkout
        sessionParams.mode = 'payment';
        sessionParams.line_items = oneTimeItems;
        // Add note about support retainer
        sessionParams.metadata.note = 'Support retainer ($75/mo) to be invoiced separately';
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Stripe error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
